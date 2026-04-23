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
import { rpcCircuitBreaker } from "../utils/circuitBreaker";

// Cache for contract existence checks (contractIdString -> { exists: boolean, timestamp: number })
const contractExistenceCache = new Map<
  string,
  { exists: boolean; timestamp: number }
>();
const CONTRACT_EXISTENCE_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Check if a contract exists on the network by looking up its account ledger entry.
 */
async function checkContractExists(
  server: StellarSdk.SorobanRpc.Server,
  contractIdString: string,
): Promise<boolean> {
  const now = Date.now();
  const cached = contractExistenceCache.get(contractIdString);
  if (cached && now - cached.timestamp < CONTRACT_EXISTENCE_CACHE_TTL) {
    metrics.recordCacheHit("contract_existence");
    return cached.exists;
  }

  metrics.recordCacheMiss("contract_existence");

  try {
    const accountId = StellarSdk.xdr.AccountId.fromString(contractIdString);
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(accountId);
    const response = await rpcCircuitBreaker.call(() =>
      server.getLedgerEntries(ledgerKey),
    );
    const exists = response.entries && response.entries.length > 0;
    contractExistenceCache.set(contractIdString, { exists, timestamp: now });
    return exists;
  } catch (err) {
    metrics.recordRpcError("unknown", "get_ledger_entries_failure");
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
  operations?: SimulateResult[];
  feeBump?: boolean;
  diagnosticEvents?: string[];
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

    const response = await rpcCircuitBreaker.call(() =>
      server.getLedgerEntries(...ledgerKeys),
    );

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
  for (const entry of auth) {
    try {
      // Logic from PR 184 for better signer extraction
      if (entry.address && typeof entry.address === "function") {
        signers.add(entry.address().toString());
      } else if (entry.credentials && typeof entry.credentials === "function") {
        const credentials = entry.credentials();
        if (credentials.switch().name === "sorobanCredentialsAddress") {
          const address = credentials.address();
          const accountId = StellarSdk.StrKey.encodeEd25519PublicKey(
            address.accountId().value(),
          );
          signers.add(accountId);
        }
      }
    } catch {
      // ignore invalid entries
    }
  }
  return { requiredSigners: Array.from(signers), threshold: signers.size };
}

/**
 * Common processing for a single simulation result (used for both single and multi-op)
 */
async function processSimulationResult(
  server: StellarSdk.SorobanRpc.Server,
  network: Network,
  transactionData: StellarSdk.xdr.SorobanTransactionData,
  cost?: { cpuInsns: string; memBytes: string },
): Promise<Partial<SimulateResult>> {
  const footprintXdr = transactionData.resources().footprint();
  const rawFootprint = {
    readOnly: footprintXdr.readOnly().map((e) => e.toXDR("base64")),
    readWrite: footprintXdr.readWrite().map((e) => e.toXDR("base64")),
  };

  const parsed = parseFootprint(rawFootprint);
  const optimizationResult = optimizeFootprint({
    readOnly: parsed.readOnly,
    readWrite: parsed.readWrite,
  });

  const allXdrEntries = [...rawFootprint.readOnly, ...rawFootprint.readWrite];
  const contracts = extractContracts(allXdrEntries);
  const ttl = await fetchTtlInfo(server, allXdrEntries, network);

  const contractType =
    contracts.length > 0
      ? await detectTokenContract(contracts[0], server)
      : "unknown";

  const auth = (transactionData as any).auth?.() ?? [];
  const { requiredSigners, threshold } = extractRequiredSigners(auth);

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
    rawFootprint,
    cost: {
      cpuInsns: cost?.cpuInsns ?? "0",
      memBytes: cost?.memBytes ?? "0",
    },
    requiredSigners,
    threshold,
  };
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

  // Handle fee-bump transactions (from PR 184)
  if (tx instanceof StellarSdk.FeeBumpTransaction) {
    const innerTx = tx.innerTransaction;
    const innerXdr = innerTx.toXDR();
    const result = await simulateTransaction(
      innerXdr,
      network,
      signal,
      ledgerSequence,
    );
    result.feeBump = true;
    return result;
  }

  const simOptions: Record<string, unknown> = { signal, includeEvents: true };
  if (ledgerSequence !== undefined) {
    simOptions.ledger = ledgerSequence;
  }

  let response;
  try {
    response = await rpcCircuitBreaker.call(() =>
      server.simulateTransaction(tx as StellarSdk.Transaction, simOptions as any),
    );
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

  const results =
    response.results ||
    (response.transactionData
      ? [{ transactionData: response.transactionData, cost: response.cost }]
      : []);

  if (results.length === 0) {
    return {
      success: false,
      error: "Simulation succeeded but no transactionData or results found.",
      raw: response,
    };
  }

  // Calculate overall resource fee
  const resourceFee = calculateResourceFee(
    response as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse,
    network,
  );

  const diagnosticEvents =
    response.events
      ?.filter((e) => e.type().name === "diagnostic")
      .map((e) => e.toXDR("base64")) || [];

  if (results.length === 1) {
    const result = results[0];
    const processed = await processSimulationResult(
      server,
      network,
      result.transactionData.build(),
      result.cost,
    );

    return {
      ...processed,
      success: true,
      resourceFee,
      diagnosticEvents,
      raw: response,
    } as SimulateResult;
  } else {
    // Multi-operation (from PR 184)
    const operations: SimulateResult[] = [];
    let allReadOnly: FootprintEntry[] = [];
    let allReadWrite: FootprintEntry[] = [];
    let allContracts: string[] = [];
    let allTtl: Record<string, TtlInfo> = {};
    let contractType: ContractType = "unknown";
    let optimized = false;
    let allRawReadOnly: string[] = [];
    let allRawReadWrite: string[] = [];

    for (const res of results) {
      const processed = await processSimulationResult(
        server,
        network,
        res.transactionData.build(),
        res.cost,
      );

      const opResult: SimulateResult = {
        success: true,
        ...processed,
      } as SimulateResult;

      operations.push(opResult);

      if (processed.footprint) {
        allReadOnly = [...allReadOnly, ...processed.footprint.readOnly];
        allReadWrite = [...allReadWrite, ...processed.footprint.readWrite];
      }
      if (processed.contracts) allContracts = [...allContracts, ...processed.contracts];
      if (processed.ttl) Object.assign(allTtl, processed.ttl);
      if (processed.optimized) optimized = true;
      if (processed.rawFootprint) {
        allRawReadOnly = [...allRawReadOnly, ...processed.rawFootprint.readOnly];
        allRawReadWrite = [...allRawReadWrite, ...processed.rawFootprint.readWrite];
      }
      if (contractType === "unknown" && processed.contractType)
        contractType = processed.contractType;
    }

    // Dedup results for the aggregate footprint
    const dedupReadOnly = allReadOnly.filter(
      (item, index, arr) =>
        arr.findIndex(
          (i) => i.contractId === item.contractId && i.key === item.key,
        ) === index,
    );
    const dedupReadWrite = allReadWrite.filter(
      (item, index, arr) =>
        arr.findIndex(
          (i) => i.contractId === item.contractId && i.key === item.key,
        ) === index,
    );

    return {
      success: true,
      footprint: {
        readOnly: dedupReadOnly,
        readWrite: dedupReadWrite,
      },
      contracts: [...new Set(allContracts)],
      contractType,
      ttl: allTtl,
      optimized,
      rawFootprint: {
        readOnly: [...new Set(allRawReadOnly)],
        readWrite: [...new Set(allRawReadWrite)],
      },
      cost: {
        cpuInsns: response.cost?.cpuInsns ?? "0",
        memBytes: response.cost?.memBytes ?? "0",
      },
      resourceFee,
      operations,
      diagnosticEvents,
      raw: response,
    };
  }
}
