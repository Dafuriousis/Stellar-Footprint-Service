import * as StellarSdk from "@stellar/stellar-sdk";
import { Network, getNetworkConfig, getRpcServer } from "@config/stellar";
import {
  parseFootprint,
  extractContracts,
  detectTokenContract,
  type FootprintEntry,
  type ContractType,
} from "./footprintParser";
import { optimizeFootprint } from "./optimizer";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { calculateResourceFee } from "./feeEstimator";
<<<<<<< ours
import metrics from "../middleware/metrics";
import { rpcCircuitBreaker } from "../utils/circuitBreaker";
import {
  FootprintStats,
  AuthEntry,
  ContractEvent,
  ContractInvocation,
  TtlInfo,
} from "../types";
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import { LRUCache, buildCacheKey } from "./cache";
import {
  SIMULATION_CACHE_TTL_MS,
  SIMULATION_CACHE_MAX_SIZE,
} from "../constants";
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
import { rpcCircuitBreaker } from "../utils/circuitBreaker";
>>>>>>> theirs

// Cache for contract existence checks (contractIdString -> { exists: boolean, timestamp: number })
const contractExistenceCache = new Map<
  string,
  { exists: boolean; timestamp: number }
>();
const CONTRACT_EXISTENCE_CACHE_TTL = 30 * 1000; // 30 seconds

function extractRequiredSigners(auth: StellarSdk.xdr.SorobanAuthorizationEntry[]): { requiredSigners: string[]; threshold: number } {
  const signers = new Set<string>();
  for (const entry of auth) {
    try {
      const credentials = entry.credentials();
      if (credentials.switch().name === 'sorobanCredentialsAddress') {
        const address = credentials.address();
        const accountId = StellarSdk.StrKey.encodeEd25519PublicKey(address.accountId().value());
        signers.add(accountId);
      }
    } catch {
      // ignore invalid entries
    }
  }
  return { requiredSigners: Array.from(signers), threshold: signers.size };
}

/**
 * Check if a contract exists on the network by looking up its account ledger entry.
 */
async function _checkContractExists(
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
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
    // Convert contractIdString to LedgerKey for an account
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountId = (StellarSdk.xdr as any).AccountId.fromString(contractIdString);
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(accountId);
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    // Build a LedgerKey for the account using the contract's public key
    const keypair = StellarSdk.Keypair.fromPublicKey(contractIdString);
    const accountId = StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(
      keypair.rawPublicKey(),
    );
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(
      new StellarSdk.xdr.LedgerKeyAccount({ accountId }),
    );
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    const response = await server.getLedgerEntries(ledgerKey);
    const accountId =
      StellarSdk.StrKey.decodeEd25519PublicKey(contractIdString);
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(
      new StellarSdk.xdr.LedgerKeyAccount({
        accountId: StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(accountId),
      }),
    );
    const response = await rpcCircuitBreaker.call(() =>
      server.getLedgerEntries(ledgerKey),
    );
    const exists = response.entries && response.entries.length > 0;
    contractExistenceCache.set(contractIdString, { exists, timestamp: now });
    return exists;
  } catch {
    metrics.recordRpcError("unknown", "get_ledger_entries_failure");
    contractExistenceCache.set(contractIdString, {
      exists: false,
      timestamp: now,
    });
    return false;
  }
}

<<<<<<< ours
=======
export interface TtlInfo {
  liveUntilLedger: number;
  expiresInLedgers: number;
}

export interface SimulateResult {
  success: boolean;
  footprint?: {
    readOnly: FootprintEntry[];
    readWrite: FootprintEntry[];
  };
  /** All unique contract IDs touched by the transaction */
  contracts?: string[];
  /** SEP-41 token contract detection result for the invoked contract */
  contractType?: ContractType;
  /** TTL information keyed by XDR hash */
  ttl?: Record<string, TtlInfo>;
  /** Optimization result showing redundant entries removed */
  optimized?: boolean;
  /** Original footprint before optimization */
  rawFootprint?: {
    readOnly: string[];
    readWrite: string[];
  };
  cost?: {
    cpuInsns: string;
    memBytes: string;
  };
  /** Resource fee calculated from simulation cost and network fee parameters */
  resourceFee?: string;
  error?: string;
  /** Contract ID that was not found (if error is "Contract not found") */
  contractId?: string;
  raw?: StellarSdk.SorobanRpc.Api.SimulateTransactionResponse;
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
  /** Per-operation results for multi-operation transactions */
  operations?: SimulateResult[];
  /** Whether this is a fee-bump transaction */
  feeBump?: boolean;
  /** Diagnostic events from contract execution */
  diagnosticEvents?: string[];
}

>>>>>>> theirs
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  /** Whether this result was served from cache */
  cacheHit?: boolean;
}

/** Shared simulation result LRU cache (singleton) */
export const simulationCache = new LRUCache<SimulateResult>(
  SIMULATION_CACHE_MAX_SIZE,
  SIMULATION_CACHE_TTL_MS,
);

<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
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
 * Calculate footprint size statistics
 */
function calculateFootprintStats(
  readOnly: string[],
  readWrite: string[],
): FootprintStats {
  const readOnlySize = readOnly.reduce(
    (sum, xdr) => sum + Buffer.from(xdr, "base64").length,
    0,
  );
  const readWriteSize = readWrite.reduce(
    (sum, xdr) => sum + Buffer.from(xdr, "base64").length,
    0,
  );

<<<<<<< ours
  return {
    readOnlyCount: readOnly.length,
    readWriteCount: readWrite.length,
    totalEntries: readOnly.length + readWrite.length,
    estimatedSizeBytes: readOnlySize + readWriteSize,
  };
}
=======
  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);

  // Handle fee-bump transactions
  if (tx instanceof StellarSdk.FeeBumpTransaction) {
    const innerTx = tx.innerTransaction;
    const innerXdr = innerTx.toXDR();
    const result = await simulateTransaction(innerXdr, network, signal, ledgerSequence);
    result.feeBump = true;
    return result;
  }

  const simOptions: Record<string, unknown> = { signal, includeEvents: true };
  if (ledgerSequence !== undefined) {
    simOptions.ledger = ledgerSequence;
  }
  const response = await server.simulateTransaction(tx, simOptions as never);
>>>>>>> theirs

/**
 * Extract contract invocation details from transaction
 */
function extractInvocation(
  tx: StellarSdk.Transaction<
    StellarSdk.Memo<StellarSdk.MemoType>,
    StellarSdk.Operation[]
  >,
): ContractInvocation | undefined {
  try {
    const op = tx.operations[0];
    if (!op || op.type !== "invokeHostFunction") {
      return undefined;
    }

    // Basic extraction - can be improved to parse xdr.HostFunction
    return {
      contractId: "",
      functionName: "",
      args: [],
    };
  } catch {
    return undefined;
  }
}

<<<<<<< ours
/**
 * Extract authorization entries from simulation response
 */
function extractAuthEntries(
  auth: StellarSdk.xdr.SorobanAuthorizationEntry[],
): AuthEntry[] {
  return auth.map((entry) => {
    return {
      contractId: "",
      functionName: "",
      xdr: entry.toXDR("base64"),
    };
  });
}

/**
 * Extract contract events from simulation response
 */
function extractEvents(
  response: StellarSdk.SorobanRpc.Api.SimulateTransactionResponse,
): ContractEvent[] {
  const events =
    (response.events as unknown as StellarSdk.xdr.DiagnosticEvent[]) ?? [];

  return events.map((event: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = event as any;
    return {
      type: e.type?.()?.name || "unknown",
      contractId: e.contractId?.()?.toString("hex") || "",
      topics: [],
      data: "",
=======
  const results = response.results || (response.transactionData ? [{ transactionData: response.transactionData, cost: response.cost }] : []);

  if (results.length === 0) {
    return {
      success: false,
      error: "Simulation succeeded but no transactionData or results; cannot extract footprint.",
      raw: response,
>>>>>>> theirs
    };
  });
}

/**
 * Extract required signers from auth entries.
 */
function extractRequiredSigners(auth: unknown[]): {
  requiredSigners: string[];
  threshold: number;
} {
  const signers = new Set<string>();
  for (const entry of auth) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = entry as any;
    try {
      if (e.address && typeof e.address === "function") {
        signers.add(e.address().toString());
      } else if (e.credentials && typeof e.credentials === "function") {
        const credentials = e.credentials();
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

<<<<<<< ours
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
  footprintStats?: FootprintStats;
  invocation?: ContractInvocation;
  authEntries?: AuthEntry[];
  events?: ContractEvent[];
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
 * Common processing for a single simulation result
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
  const optimizationResult = optimizeFootprint(
    parsed.readOnly,
    parsed.readWrite,
  );

  const allXdrEntries = [...rawFootprint.readOnly, ...rawFootprint.readWrite];
  const contracts = extractContracts(allXdrEntries);
  const ttl = await fetchTtlInfo(server, allXdrEntries, network);

  const contractType =
    contracts.length > 0
      ? await detectTokenContract(contracts[0], server)
      : "unknown";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auth = (transactionData as any)?.auth?.() ?? [];
  const { requiredSigners, threshold } = extractRequiredSigners(auth);

  const footprintStats = calculateFootprintStats(
    rawFootprint.readOnly,
    rawFootprint.readWrite,
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
    rawFootprint,
    footprintStats,
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
<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
  const cacheKey = buildCacheKey(xdr, network);
  const cached = simulationCache.get(cacheKey);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const server = getRpcServer(network);
>>>>>>> theirs
  const { networkPassphrase } = getNetworkConfig(network);
  const server = getRpcServer(network);

  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);

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
      server.simulateTransaction(
        tx as StellarSdk.Transaction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        simOptions as any,
      ),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response as any).results ||
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

  const resourceFee = await calculateResourceFee(
    response.cost?.cpuInsns ?? "0",
    response.cost?.memBytes ?? "0",
    network,
  );

  const events = extractEvents(response);

<<<<<<< ours
<<<<<<< ours
  if (results.length === 1) {
    const result = results[0];
    const processed = await processSimulationResult(
      server,
      network,
      result.transactionData.build(),
      result.cost,
    );

    const invocation = extractInvocation(
      tx as StellarSdk.Transaction<
        StellarSdk.Memo<StellarSdk.MemoType>,
        StellarSdk.Operation[]
      >,
    );

    const authEntries = extractAuthEntries(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result.transactionData.build() as any)?.auth?.() ?? [],
    );

    return {
      ...processed,
      success: true,
      resourceFee,
      invocation,
      authEntries,
      events,
      raw: response,
    } as SimulateResult;
  } else {
    // Multi-operation
=======
  if (results.length === 1) {
    // Single operation
    const result = results[0];
    if (!result.transactionData) {
      return {
        success: false,
        error: "Simulation succeeded but transactionData is missing; cannot extract footprint.",
        raw: response,
      };
    }

    const footprint = result.transactionData.build().resources().footprint();
    const rawFootprint = {
      readOnly: footprint.readOnly().map((e) => e.toXDR("base64")),
      readWrite: footprint.readWrite().map((e) => e.toXDR("base64")),
    };

<<<<<<< ours
<<<<<<< ours
    // Parse footprint entries to extract contract IDs and classify types
    const parsedFootprint = parseFootprint(rawFootprint);

    // Extract all contracts touched by the transaction
    const allEntries = [...rawFootprint.readOnly, ...rawFootprint.readWrite];
    const contracts = extractContracts(allEntries);

    // Optimize footprint by removing redundant read-only entries
    const optimizationResult = optimizeFootprint(
      parsedFootprint.readOnly,
      parsedFootprint.readWrite,
    );

    // Get all XDR strings for TTL lookup (use original footprint)
    const allXdrEntries = [...rawFootprint.readOnly, ...rawFootprint.readWrite];

    // Fetch TTL information
    const ttl = await fetchTtlInfo(server, allXdrEntries);

    // Extract required signers from auth entries
    const auth = result.transactionData?.build().auth() ?? [];
    const { requiredSigners, threshold } = extractRequiredSigners(auth);

    // Detect SEP-41 token contract type for the first invoked contract
    const contractType =
      contracts.length > 0
        ? await detectTokenContract(contracts[0], server)
        : "unknown";

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
        cpuInsns: result.cost?.cpuInsns ?? "0",
        memBytes: result.cost?.memBytes ?? "0",
      },
      requiredSigners,
      threshold,
      raw: response,
      diagnosticEvents: response.events?.filter(e => e.type().name === 'diagnostic').map(e => e.toXDR('base64')) || [],
    };
  } else {
    // Multi operation
>>>>>>> theirs
    const operations: SimulateResult[] = [];
    let allReadOnly: FootprintEntry[] = [];
    let allReadWrite: FootprintEntry[] = [];
    let allContracts: string[] = [];
<<<<<<< ours
    const allTtl: Record<string, TtlInfo> = {};
=======
    let allTtl: Record<string, TtlInfo> = {};
>>>>>>> theirs
    let contractType: ContractType = "unknown";
    let optimized = false;
    let allRawReadOnly: string[] = [];
    let allRawReadWrite: string[] = [];

<<<<<<< ours
    for (const res of results) {
      const processed = await processSimulationResult(
        server,
        network,
        res.transactionData.build(),
        res.cost,
      );

      operations.push({
        success: true,
        ...processed,
      } as SimulateResult);

      if (processed.footprint) {
        allReadOnly = [...allReadOnly, ...processed.footprint.readOnly];
        allReadWrite = [...allReadWrite, ...processed.footprint.readWrite];
      }
      if (processed.contracts)
        allContracts = [...allContracts, ...processed.contracts];
      if (processed.ttl) Object.assign(allTtl, processed.ttl);
      if (processed.optimized) optimized = true;
      if (processed.rawFootprint) {
        allRawReadOnly = [
          ...allRawReadOnly,
          ...processed.rawFootprint.readOnly,
        ];
        allRawReadWrite = [
          ...allRawReadWrite,
          ...processed.rawFootprint.readWrite,
        ];
      }
      if (contractType === "unknown" && processed.contractType)
        contractType = processed.contractType;
    }

    const dedupReadOnly = allReadOnly.filter(
      (item, index, arr) =>
        arr.findIndex(
          (i) => i.contractId === item.contractId && i.xdr === item.xdr,
=======
    for (const result of results) {
      if (!result.transactionData) {
        return {
          success: false,
          error: "Simulation succeeded but transactionData is missing for one operation; cannot extract footprint.",
          raw: response,
        };
      }

      const footprint = result.transactionData.build().resources().footprint();
      const rawFootprint = {
        readOnly: footprint.readOnly().map((e) => e.toXDR("base64")),
        readWrite: footprint.readWrite().map((e) => e.toXDR("base64")),
      };

      const parsedFootprint = parseFootprint(rawFootprint);

      const allEntries = [...rawFootprint.readOnly, ...rawFootprint.readWrite];
      const contracts = extractContracts(allEntries);

      const optimizationResult = optimizeFootprint(
        parsedFootprint.readOnly,
        parsedFootprint.readWrite,
      );

      const allXdrEntries = [...rawFootprint.readOnly, ...rawFootprint.readWrite];

      const ttl = await fetchTtlInfo(server, allXdrEntries);

      const auth = result.transactionData?.build().auth() ?? [];
      const { requiredSigners, threshold } = extractRequiredSigners(auth);

      const opContractType =
        contracts.length > 0
          ? await detectTokenContract(contracts[0], server)
          : "unknown";

      if (contractType === "unknown") contractType = opContractType;

      const opResult: SimulateResult = {
        success: true,
        footprint: {
          readOnly: optimizationResult.readOnly,
          readWrite: optimizationResult.readWrite,
        },
        contracts,
        contractType: opContractType,
        ttl,
        optimized: optimizationResult.optimized,
        rawFootprint,
        cost: {
          cpuInsns: result.cost?.cpuInsns ?? "0",
          memBytes: result.cost?.memBytes ?? "0",
        },
        requiredSigners,
        threshold,
      };

      operations.push(opResult);

      allReadOnly = [...allReadOnly, ...optimizationResult.readOnly];
      allReadWrite = [...allReadWrite, ...optimizationResult.readWrite];
      allContracts = [...allContracts, ...contracts];
      Object.assign(allTtl, ttl);
      if (optimizationResult.optimized) optimized = true;
      allRawReadOnly = [...allRawReadOnly, ...rawFootprint.readOnly];
      allRawReadWrite = [...allRawReadWrite, ...rawFootprint.readWrite];
    }

    // Dedup
    const dedupReadOnly = allReadOnly.filter(
      (item, index, arr) =>
        arr.findIndex(
          (i) => i.contractId === item.contractId && i.key === item.key,
>>>>>>> theirs
        ) === index,
    );
    const dedupReadWrite = allReadWrite.filter(
      (item, index, arr) =>
        arr.findIndex(
<<<<<<< ours
          (i) => i.contractId === item.contractId && i.xdr === item.xdr,
        ) === index,
    );

    const footprintStats = calculateFootprintStats(
      allRawReadOnly,
      allRawReadWrite,
    );
=======
          (i) => i.contractId === item.contractId && i.key === item.key,
        ) === index,
    );
    const dedupContracts = [...new Set(allContracts)];
    const dedupRawReadOnly = [...new Set(allRawReadOnly)];
    const dedupRawReadWrite = [...new Set(allRawReadWrite)];
>>>>>>> theirs

    return {
      success: true,
      footprint: {
        readOnly: dedupReadOnly,
        readWrite: dedupReadWrite,
      },
<<<<<<< ours
      contracts: [...new Set(allContracts)],
=======
      contracts: dedupContracts,
>>>>>>> theirs
      contractType,
      ttl: allTtl,
      optimized,
      rawFootprint: {
<<<<<<< ours
        readOnly: [...new Set(allRawReadOnly)],
        readWrite: [...new Set(allRawReadWrite)],
      },
      footprintStats,
=======
        readOnly: dedupRawReadOnly,
        readWrite: dedupRawReadWrite,
      },
>>>>>>> theirs
      cost: {
        cpuInsns: response.cost?.cpuInsns ?? "0",
        memBytes: response.cost?.memBytes ?? "0",
      },
<<<<<<< ours
      resourceFee,
      operations,
      events,
      raw: response,
    };
  }
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  const result: SimulateResult = {
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

  simulationCache.set(cacheKey, result);
  return { ...result, cacheHit: false };
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
}
=======
      operations,
      raw: response,
      diagnosticEvents: response.events?.filter(e => e.type().name === 'diagnostic').map(e => e.toXDR('base64')) || [],
    };
  }
>>>>>>> theirs
