import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Parse XDR string into a Transaction object
 */
export function parseXdr(
  xdr: string,
  networkPassphrase: string,
): StellarSdk.Transaction<StellarSdk.Memo, StellarSdk.Operation[]> | StellarSdk.FeeBumpTransaction {
  return StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
}
