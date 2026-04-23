import * as StellarSdk from "@stellar/stellar-sdk";
import { Network, getNetworkConfig, getRpcServer } from "@config/stellar";
import { sanitizeRpcError } from "../utils/rpcErrorSanitizer";
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
import {
  FootprintStats,
  AuthEntry,
  ContractEvent,
  ContractInvocation,
  TtlInfo,
} from "../types";

// Cache for contract existence checks (contractIdString -> { exists: boolean, timestamp: number })
const contractExistenceCache = new Map<
  string,
  { exists: boolean; timestamp: number }
>();
const CONTRACT_EXISTENCE_CACHE_TTL = 30 * 1000; // 30 seconds

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
    // Convert contractIdString to LedgerKey for an account
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountId = (StellarSdk.xdr as any).AccountId.fromString(contractIdString);
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(accountId);
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

  return {
    readOnlyCount: readOnly.length,
    readWriteCount: readWrite.length,
    totalEntries: readOnly.length + readWrite.length,
    estimatedSizeBytes: readOnlySize + readWriteSize,
  };
}

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
  // getNetworkConfig and getRpcServer are called inside the try block so that
  // synchronous throws (e.g. missing RPC URL) are caught by the caller's
  // error handler rather than propagating as unhandled rejections.
  let server: StellarSdk.SorobanRpc.Server;
  let networkPassphrase: string;
  let tx: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction;

  try {
    ({ networkPassphrase } = getNetworkConfig(network));
    server = getRpcServer(network);
    tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
  } catch (err) {
    throw err;
  }

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

  // Reject classic (non-Soroban) transactions before hitting the RPC
  const hasSorobanOp = (tx as StellarSdk.Transaction).operations.some(
    (op) => op.type === "invokeHostFunction",
  );
  if (!hasSorobanOp) {
    return {
      success: false,
      error: "Transaction must contain a Soroban operation (invokeHostFunction).",
    };
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
    return {
      success: false,
      type: "simulation_error" as const,
      error: sanitizeRpcError(response.error),
      raw: response,
    };
  }

  if (StellarSdk.SorobanRpc.Api.isSimulationRestore(response)) {
    return {
      success: false,
      type: "restoration_required" as const,
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
    const operations: SimulateResult[] = [];
    let allReadOnly: FootprintEntry[] = [];
    let allReadWrite: FootprintEntry[] = [];
    let allContracts: string[] = [];
    const allTtl: Record<string, TtlInfo> = {};
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
        ) === index,
    );
    const dedupReadWrite = allReadWrite.filter(
      (item, index, arr) =>
        arr.findIndex(
          (i) => i.contractId === item.contractId && i.xdr === item.xdr,
        ) === index,
    );

    const footprintStats = calculateFootprintStats(
      allRawReadOnly,
      allRawReadWrite,
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
      footprintStats,
      cost: {
        cpuInsns: response.cost?.cpuInsns ?? "0",
        memBytes: response.cost?.memBytes ?? "0",
      },
      resourceFee,
      operations,
      events,
      raw: response,
    };
  }
}

export class SimulationTimeoutError extends Error {
  constructor() {
    super("Simulation timed out");
    this.name = "SimulationTimeoutError";
  }
}

const DEFAULT_SIMULATE_TIMEOUT_MS = 30000;

export async function simulateWithTimeout(
  xdr: string,
  network: Network = "testnet",
  signal?: AbortSignal,
  ledgerSequence?: number,
): Promise<SimulateResult> {
  const timeoutMs = parseInt(
    process.env.SIMULATE_TIMEOUT_MS || String(DEFAULT_SIMULATE_TIMEOUT_MS),
    10,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SimulationTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([
      simulateTransaction(xdr, network, signal, ledgerSequence),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
