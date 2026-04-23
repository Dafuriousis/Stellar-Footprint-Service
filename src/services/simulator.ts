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
    return cached.exists;
  }

  try {
    // Convert contractIdString to LedgerKey for an account
    const accountId = StellarSdk.xdr.AccountId.fromString(contractIdString);
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(accountId);
    const response = await server.getLedgerEntries(ledgerKey);
    const exists = response.entries && response.entries.length > 0;
    contractExistenceCache.set(contractIdString, { exists, timestamp: now });
    return exists;
  } catch (err) {
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
 * @property success - Whether the simulation succeeded
 * @property footprint - Extracted read-only and read-write ledger entries
 * @property contracts - All unique contract IDs touched by the transaction
 * @property contractType - SEP-41 token contract detection result
 * @property ttl - TTL information keyed by XDR hash
 * @property optimized - Whether footprint was optimized
 * @property rawFootprint - Original footprint before optimization
 * @property cost - Resource costs (CPU instructions and memory bytes)
 * @property resourceFee - Resource fee calculated from simulation cost
 * @property error - Error message if simulation failed
 * @property contractId - Contract ID that was not found (if applicable)
 * @property raw - Raw RPC response
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
}

/**
 * Fetch TTL information for footprint entries via RPC
 * @param server - The RPC server instance
 * @param footprintEntries - Array of base64 XDR entries
 * @returns Map of XDR hash to TTL info
 */
async function fetchTtlInfo(
  server: StellarSdk.SorobanRpc.Server,
  footprintEntries: string[],
): Promise<Record<string, TtlInfo>> {
  if (footprintEntries.length === 0) {
    return {};
  }

  try {
    // Convert base64 strings to LedgerKey objects for SDK 12.x
    const ledgerKeys = footprintEntries.map((xdr) => {
      return StellarSdk.xdr.LedgerKey.fromXDR(xdr, "base64");
    });

    // SDK 12.x accepts single key or array
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
    // If TTL fetching fails, return empty map
    return {};
  }
}

/**
 * Simulate a Soroban transaction and extract its footprint
 * @param xdr - Base64-encoded transaction XDR
 * @param network - The network to simulate against ("testnet" or "mainnet")
 * @param signal - Optional AbortSignal for request cancellation
 * @param ledgerSequence - Optional specific ledger sequence to simulate against
 * @returns Simulation result with footprint, contracts, costs, and TTL info
 */
export async function simulateTransaction(
  xdr: string,
  network: Network = "testnet",
  signal?: AbortSignal,
  ledgerSequence?: number,
): Promise<SimulateResult> {
  const { networkPassphrase } = getNetworkConfig(network);

  // Parse XDR
  const tx = parseXdr(xdr, networkPassphrase);

  // Simulate via RPC
  const response = await simulateViaRpc(tx, network, signal, ledgerSequence);

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

  // Extract footprint
  let extracted;
  try {
    extracted = await extractFootprint(response as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse, network);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error:
        "Simulation succeeded but transactionData is missing; cannot extract footprint.",
      raw: response,
    };
  }

  // Fetch TTL information
  const ttl = await fetchTtlInfo(server, allXdrEntries);

  // Detect SEP-41 token contract type for the first invoked contract
  const contractType =
    contracts.length > 0
      ? await detectTokenContract(contracts[0], server)
      : "unknown";

  return {
    success: true,
    footprint: {
      readOnly: extracted.optimizationResult.readOnly,
      readWrite: extracted.optimizationResult.readWrite,
    },
    contracts: extracted.contracts,
    contractType: extracted.contractType,
    ttl,
    optimized: extracted.optimizationResult.optimized,
    rawFootprint: extracted.rawFootprint,
    cost: {
      cpuInsns: response.cost?.cpuInsns ?? "0",
      memBytes: response.cost?.memBytes ?? "0",
    },
    raw: response,
  };
}
