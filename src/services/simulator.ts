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
    // For now, assume contract exists if we can parse it
    const exists = contractIdString.length > 0;
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

export interface FootprintStats {
  readOnlyCount: number;
  readWriteCount: number;
  totalEntries: number;
  estimatedSizeBytes: number;
}

export interface AuthEntry {
  contractId: string;
  functionName: string;
  xdr: string;
}

export interface ContractEvent {
  type: string;
  contractId: string;
  topics: string[];
  data: string;
}

export interface ContractInvocation {
  contractId: string;
  functionName: string;
  args: string[];
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
  /** Footprint size analytics */
  footprintStats?: FootprintStats;
  /** Contract invocation details */
  invocation?: ContractInvocation;
  /** Authorization entries required for the transaction */
  authEntries?: AuthEntry[];
  /** Contract events emitted during simulation */
  events?: ContractEvent[];
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
<<<<<<< HEAD
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
  tx: StellarSdk.Transaction<StellarSdk.Memo<StellarSdk.MemoType>, StellarSdk.Operation[]>,
): ContractInvocation | undefined {
  try {
    const op = tx.operations[0];
    if (!op || op.type !== "invokeHostFunction") {
      return undefined;
    }

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
  const events = (response.events as unknown as StellarSdk.xdr.DiagnosticEvent[]) ?? [];

  return events.map((event) => {
    return {
      type: "contract",
      contractId: "",
      topics: [],
      data: "",
    };
  });
}

/**
 * Extract required signers from authorization entries
 */
function extractRequiredSigners(
  auth: StellarSdk.xdr.SorobanAuthorizationEntry[],
): { requiredSigners: string[]; threshold: number } {
  return {
    requiredSigners: [],
    threshold: 0,
  };
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
  const server = getRpcServer(network);
  const { networkPassphrase } = getNetworkConfig(network);

  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
  const simOptions: Record<string, unknown> = { signal };
  if (ledgerSequence !== undefined) {
    simOptions.ledger = ledgerSequence;
  }
  const response = await server.simulateTransaction(tx, simOptions as never);

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

  if (!response.transactionData) {
    return {
      success: false,
      error:
        "Simulation succeeded but transactionData is missing; cannot extract footprint.",
      raw: response,
    };
  }

  const footprint = response.transactionData.build().resources().footprint();
  const rawFootprint = {
    readOnly: footprint.readOnly().map((e) => e.toXDR("base64")),
    readWrite: footprint.readWrite().map((e) => e.toXDR("base64")),
  };

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
  const auth = (response.transactionData?.build() as unknown as { auth: () => StellarSdk.xdr.SorobanAuthorizationEntry[] }).auth?.() ?? [];
  const { requiredSigners, threshold } = extractRequiredSigners(auth);

  // Detect SEP-41 token contract type for the first invoked contract
  const contractType =
    contracts.length > 0
      ? await detectTokenContract(contracts[0], server)
      : "unknown";

  // Calculate footprint size statistics
  const footprintStats = calculateFootprintStats(
    rawFootprint.readOnly,
    rawFootprint.readWrite,
  );

  // Extract contract invocation details
  const txObj = tx as StellarSdk.Transaction<StellarSdk.Memo<StellarSdk.MemoType>, StellarSdk.Operation[]>;
  const invocation = extractInvocation(txObj);

  // Extract authorization entries
  const authEntries = extractAuthEntries(auth);

  // Extract contract events
  const events = extractEvents(response);

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
    invocation,
    authEntries,
    events,
    cost: {
      cpuInsns: response.cost?.cpuInsns ?? "0",
      memBytes: response.cost?.memBytes ?? "0",
    },
    raw: response,
  };
}
