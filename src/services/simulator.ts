import * as StellarSdk from "@stellar/stellar-sdk";
import { Network, getNetworkConfig } from "../config/stellar";
import { parseXdr } from "./xdrParser";
import { simulateViaRpc, fetchTtlInfo as fetchTtlInfoRpc } from "./rpcClient";
import { extractFootprint } from "./footprintExtractor";
import type { FootprintEntry, ContractType } from "./footprintParser";

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
      error: message,
      raw: response,
    };
  }

  // Fetch TTL information
  const allXdrEntries = [
    ...extracted.rawFootprint.readOnly,
    ...extracted.rawFootprint.readWrite,
  ];
  const ttl = await fetchTtlInfoRpc(network, allXdrEntries);

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
