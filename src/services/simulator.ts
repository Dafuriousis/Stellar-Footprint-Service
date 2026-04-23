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
  /** Per-operation results for multi-operation transactions */
  operations?: SimulateResult[];
  /** Whether this is a fee-bump transaction */
  feeBump?: boolean;
  /** Diagnostic events from contract execution */
  diagnosticEvents?: string[];
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

export async function simulateTransaction(
  xdr: string,
  network: Network = "testnet",
  signal?: AbortSignal,
  ledgerSequence?: number,
): Promise<SimulateResult> {
  const server = getRpcServer(network);
  const { networkPassphrase } = getNetworkConfig(network);

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

  const results = response.results || (response.transactionData ? [{ transactionData: response.transactionData, cost: response.cost }] : []);

  if (results.length === 0) {
    return {
      success: false,
      error: "Simulation succeeded but no transactionData or results; cannot extract footprint.",
      raw: response,
    };
  }

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
    const operations: SimulateResult[] = [];
    let allReadOnly: FootprintEntry[] = [];
    let allReadWrite: FootprintEntry[] = [];
    let allContracts: string[] = [];
    let allTtl: Record<string, TtlInfo> = {};
    let contractType: ContractType = "unknown";
    let optimized = false;
    let allRawReadOnly: string[] = [];
    let allRawReadWrite: string[] = [];

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
        ) === index,
    );
    const dedupReadWrite = allReadWrite.filter(
      (item, index, arr) =>
        arr.findIndex(
          (i) => i.contractId === item.contractId && i.key === item.key,
        ) === index,
    );
    const dedupContracts = [...new Set(allContracts)];
    const dedupRawReadOnly = [...new Set(allRawReadOnly)];
    const dedupRawReadWrite = [...new Set(allRawReadWrite)];

    return {
      success: true,
      footprint: {
        readOnly: dedupReadOnly,
        readWrite: dedupReadWrite,
      },
      contracts: dedupContracts,
      contractType,
      ttl: allTtl,
      optimized,
      rawFootprint: {
        readOnly: dedupRawReadOnly,
        readWrite: dedupRawReadWrite,
      },
      cost: {
        cpuInsns: response.cost?.cpuInsns ?? "0",
        memBytes: response.cost?.memBytes ?? "0",
      },
      operations,
      raw: response,
      diagnosticEvents: response.events?.filter(e => e.type().name === 'diagnostic').map(e => e.toXDR('base64')) || [],
    };
  }
