import * as StellarSdk from "@stellar/stellar-sdk";

export type XdrInputType = "transaction" | "operation";

export interface ValidateResult {
  valid: boolean;
  type?: XdrInputType;
  operationCount?: number;
  operationType?: string;
  error?: string;
}

export function validateXdr(
  xdr: string,
  type: XdrInputType = "transaction",
): ValidateResult {
  try {
    if (type === "transaction") {
      // Try both testnet and mainnet passphrases
      let tx: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction;
      try {
        tx = StellarSdk.TransactionBuilder.fromXDR(
          xdr,
          StellarSdk.Networks.TESTNET,
        );
      } catch {
        tx = StellarSdk.TransactionBuilder.fromXDR(
          xdr,
          StellarSdk.Networks.PUBLIC,
        );
      }

      const ops =
        tx instanceof StellarSdk.FeeBumpTransaction
          ? tx.innerTransaction.operations
          : tx.operations;

      return {
        valid: true,
        type: "transaction",
        operationCount: ops.length,
        operationType: ops[0]?.type ?? "unknown",
      };
    } else {
      const op = StellarSdk.xdr.Operation.fromXDR(xdr, "base64");
      const decoded = StellarSdk.Operation.fromXDRObject(op);
      return {
        valid: true,
        type: "operation",
        operationCount: 1,
        operationType: decoded.type,
      };
    }
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Failed to parse XDR",
    };
  }
}
