import * as StellarSdk from "@stellar/stellar-sdk";
import { Network, getNetworkConfig, getRpcServer } from "../config/stellar";

export interface RestoreResult {
  needsRestore: boolean;
  restoreXdr?: string;
  fee?: string;
}

export async function buildRestoreTransaction(
  xdr: string,
  network: Network = "testnet",
): Promise<RestoreResult> {
  const server = getRpcServer(network);
  const { networkPassphrase } = getNetworkConfig(network);

  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
  const response = await server.simulateTransaction(tx);

  if (!StellarSdk.SorobanRpc.Api.isSimulationRestore(response)) {
    return { needsRestore: false };
  }

  const sourceAccount =
    "innerTransaction" in tx ? tx.innerTransaction.source : tx.source;
  const account = await server.getAccount(sourceAccount);
  const fee = StellarSdk.BASE_FEE;
  const restoreTx = new StellarSdk.TransactionBuilder(account, {
    fee,
    networkPassphrase,
  })
    .setSorobanData(response.restorePreamble.transactionData.build())
    .addOperation(StellarSdk.Operation.restoreFootprint({}))
    .setTimeout(30)
    .build();

  return {
    needsRestore: true,
    restoreXdr: restoreTx.toXDR(),
    fee,
  };
}
