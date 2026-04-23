import * as StellarSdk from "@stellar/stellar-sdk";

export type XdrType = "transaction" | "operation" | "ledger_key";

export interface DecodeResult {
  success: boolean;
  type: XdrType;
  decoded?: unknown;
  error?: string;
}

/**
 * Serialize an XDR LedgerKey to a plain object by inspecting its arm/value.
 */
function ledgerKeyToJson(key: StellarSdk.xdr.LedgerKey): unknown {
  const arm = key.arm();
  const value = key.value() as Record<string, unknown>;
  const result: Record<string, unknown> = { type: arm };

  for (const [k, v] of Object.entries(value)) {
    if (v && typeof (v as { toXDR?: unknown }).toXDR === "function") {
      result[k] = (v as { toXDR: (fmt: string) => string }).toXDR("base64");
    } else {
      result[k] = v;
    }
  }

  return result;
}

/**
 * Decode a base64 XDR string into a human-readable JSON representation.
 * Supports transaction envelopes, individual operations, and ledger keys.
 */
export function decodeXdr(xdr: string, type: XdrType): DecodeResult {
  try {
    let decoded: unknown;

    switch (type) {
      case "transaction": {
        // TransactionBuilder.fromXDR returns a Transaction or FeeBumpTransaction
        // with rich, readable properties (source, operations, memo, etc.)
        const tx = StellarSdk.TransactionBuilder.fromXDR(
          xdr,
          StellarSdk.Networks.TESTNET,
        );
        decoded = JSON.parse(JSON.stringify(tx));
        break;
      }

      case "operation": {
        const opXdr = StellarSdk.xdr.Operation.fromXDR(xdr, "base64");
        const op = StellarSdk.Operation.fromXDRObject(opXdr);
        decoded = op;
        break;
      }

      case "ledger_key": {
        const key = StellarSdk.xdr.LedgerKey.fromXDR(xdr, "base64");
        decoded = ledgerKeyToJson(key);
        break;
      }

      default:
        return {
          success: false,
          type,
          error: `Unsupported type. Supported types: transaction, operation, ledger_key`,
        };
    }

    return { success: true, type, decoded };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid XDR format";
    return { success: false, type, error: message };
  }
}
