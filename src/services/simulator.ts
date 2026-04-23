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
  error?: string;
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

export async function simulateTransaction(
  xdr: string,
  network: Network = "testnet",
  signal?: AbortSignal,
): Promise<SimulateResult> {
  const server = getRpcServer(network);
  const { networkPassphrase } = getNetworkConfig(network);

  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
  const response = await server.simulateTransaction(tx, { signal } as never);

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

  const footprint = response.transactionData?.build().resources().footprint();
  const rawFootprint = {
    readOnly: footprint?.readOnly().map((e) => e.toXDR("base64")) ?? [],
    readWrite: footprint?.readWrite().map((e) => e.toXDR("base64")) ?? [],
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
      cpuInsns: response.cost?.cpuInsns ?? "0",
      memBytes: response.cost?.memBytes ?? "0",
    },
    raw: response,
  };
}
