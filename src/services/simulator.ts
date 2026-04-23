import * as StellarSdk from "@stellar/stellar-sdk";
import { Network, getNetworkConfig, getRpcServer } from "../config/stellar";
import {
  parseFootprint,
  extractContracts,
  detectTokenContract,
  type FootprintEntry,
  type ContractType,
} from "./footprintParser";
import { optimizeFootprint } from "./optimizer";
import { calculateResourceFee } from "./feeEstimator";
import metrics from "../middleware/metrics";

// Cache for contract existence checks (contractIdString -> { exists: boolean, timestamp: number })
const contractExistenceCache = new Map<
  string,
  { exists: boolean; timestamp: number }
>();
const CONTRACT_EXISTENCE_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Check if a contract exists on the network by looking up its account ledger entry.
 * Uses caching to avoid repeated RPC calls for the same contract within the TTL.
 * @param server - The RPC server instance
 * @param contractIdString - The contract ID in string format (account ID)
 * @returns True if the contract exists, false otherwise
 */
async function checkContractExists(
  server: StellarSdk.SorobanRpc.Server,
  contractIdString: string,
): Promise<boolean> {
  const now = Date.now();
  const cached = contractExistenceCache.get(contractIdString);
  if (cached && now - cached.timestamp < CONTRACT_EXISTENCE_CACHE_TTL) {
    // Record cache hit
    metrics.recordCacheHit("contract_existence");
    return cached.exists;
  }

  // Record cache miss
  metrics.recordCacheMiss("contract_existence");

  try {
    // Convert contractIdString to LedgerKey for an account
    const accountId = StellarSdk.xdr.AccountId.fromString(contractIdString);
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(accountId);
    const response = await server.getLedgerEntries(ledgerKey);
    const exists = response.entries && response.entries.length > 0;
    contractExistenceCache.set(contractIdString, { exists, timestamp: now });
    return exists;
  } catch (err) {
    // Record RPC error
    metrics.recordRpcError("unknown", "get_ledger_entries_failure");

    // If there's an error (e.g., network, invalid ID), assume contract does not exist
    contractExistenceCache.set(contractIdString, {
      exists: false,
      timestamp: now,
    });
    return false;
  }
}

export interface TtlInfo {
  liveUntilLedger: number;
  expiresInLedgers: number;
}

/**
 * Result of a transaction simulation
 */
export interface SimulateResult {
  success: boolean;
  footprint?: {
    readOnly: FootprintEntry[];
    readWrite: FootprintEntry[];
  };
  contracts?: string[];
  contractType?: ContractType;
  ttl?: Record<string, TtlInfo>;
  optimized?: boolean;
  rawFootprint?: {
    readOnly: string[];
    readWrite: string[];
  };
  cost?: {
    cpuInsns: string;
    memBytes: string;
  };
  resourceFee?: string;
  error?: string;
  contractId?: string;
  raw?: StellarSdk.SorobanRpc.Api.SimulateTransactionResponse;
  requiredSigners?: string[];
  threshold?: number;
}

/**
 * Fetch TTL information for footprint entries via RPC
 */
async function fetchTtlInfo(
  server: StellarSdk.SorobanRpc.Server,
  footprintEntries: string[],
  network: Network,
): Promise<Record<string, TtlInfo>> {
  if (footprintEntries.length === 0) {
    return {};
  }

  try {
    const ledgerKeys = footprintEntries.map((xdr) => {
      return StellarSdk.xdr.LedgerKey.fromXDR(xdr, "base64");
    });

    const response = await server.getLedgerEntries(...ledgerKeys);

    const ttlMap: Record<string, TtlInfo> = {};
    const currentLedger = response.latestLedger ?? 0;

    if (response.entries) {
      for (let i = 0; i < response.entries.length; i++) {
        const entry = response.entries[i];
        const xdr = footprintEntries[i];

        if (entry.liveUntilLedgerSeq) {
          const liveUntilLedger = Number(entry.liveUntilLedgerSeq);
          const expiresInLedgers = liveUntilLedger - currentLedger;

          ttlMap[xdr] = {
            liveUntilLedger,
            expiresInLedgers,
          };
        }
      }
    }

    return ttlMap;
  } catch {
    metrics.recordRpcError(network, "fetch_ttl_failure");
    return {};
  }
}

/**
 * Extract required signers from auth entries.
 */
function extractRequiredSigners(auth: any[]): {
  requiredSigners: string[];
  threshold: number;
} {
  const signers = new Set<string>();
  let threshold = 0;

  for (const entry of auth) {
    if (entry.address && entry.address()) {
      signers.add(entry.address().toString());
    }
  }

  return { requiredSigners: Array.from(signers), threshold };
}

/**
 * Simulate a Soroban transaction and extract its footprint
 */
export async function simulateTransaction(
  xdr: string,
  network: Network = "testnet",
  signal?: AbortSignal,
  ledgerSequence?: number,
): Promise<SimulateResult> {
  const { networkPassphrase } = getNetworkConfig(network);
  const server = getRpcServer(network);

  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);

  let response;
  try {
    response = await server.simulateTransaction(tx, { signal } as any);
  } catch (err) {
    metrics.recordRpcError(network, "simulate_transaction_failure");
    throw err;
  }

  if (StellarSdk.SorobanRpc.Api.isSimulationError(response)) {
    return { success: false, error: response.error, raw: response };
  }

  if (StellarSdk.SorobanRpc.Api.isSimulationRestore(response)) {
    return {
      success: false,
      error: "Transaction requires ledger entry restoration before simulation.",
      raw: response,
    };
  }

  // Extract footprint and other data
  const successResponse =
    response as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse;
  const transactionData = successResponse.transactionData;

  if (!transactionData) {
    return {
      success: false,
      error: "Simulation succeeded but transactionData is missing.",
      raw: response,
    };
  }

  const footprintXdr = transactionData.resources().footprint();
  const readOnly = footprintXdr.readOnly().map((e) => e.toXDR("base64"));
  const readWrite = footprintXdr.readWrite().map((e) => e.toXDR("base64"));

  const parsedFootprint = parseFootprint(readOnly, readWrite);
  const contracts = extractContracts(parsedFootprint);
  const optimizationResult = optimizeFootprint(parsedFootprint);

  // Fetch TTL info
  const allXdrEntries = [...readOnly, ...readWrite];
  const ttl = await fetchTtlInfo(server, allXdrEntries, network);

  // Detect token contract type
  const contractType =
    contracts.length > 0
      ? await detectTokenContract(contracts[0], server)
      : "unknown";

  // Calculate resource fee
  const resourceFee = calculateResourceFee(successResponse, network);

  // Extract signers
  const { requiredSigners, threshold } = extractRequiredSigners(
    successResponse.results?.flatMap((r) => r.auth || []) || [],
  );

  return {
    success: true,
    footprint: {
      readOnly: optimizationResult.readOnly,
      readWrite: optimizationResult.readWrite,
    },
    contracts,
    contractType,
    ttl,
    optimized: optimizationResult.optimized,
    rawFootprint: {
      readOnly,
      readWrite,
    },
    cost: {
      cpuInsns: successResponse.cost?.cpuInsns ?? "0",
      memBytes: successResponse.cost?.memBytes ?? "0",
    },
    resourceFee,
    requiredSigners,
    threshold,
    raw: response,
  };
}
