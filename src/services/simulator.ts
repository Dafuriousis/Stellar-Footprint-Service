import * as StellarSdk from "@stellar/stellar-sdk";
import { Network, getNetworkConfig, getRpcServer } from "../config/stellar";

export interface SimulateResult {
  success: boolean;
  footprint?: {
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

  return {
    success: true,
    footprint: {
      readOnly: footprint?.readOnly().map((e) => e.toXDR("base64")) ?? [],
      readWrite: footprint?.readWrite().map((e) => e.toXDR("base64")) ?? [],
    },
    cost: {
      cpuInsns: response.cost?.cpuInsns ?? "0",
      memBytes: response.cost?.memBytes ?? "0",
    },
    raw: response,
  };
}
