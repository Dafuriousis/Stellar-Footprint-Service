import { logger } from "./logger";

/**
 * Maps known Stellar RPC error patterns to safe user-facing messages.
 * Logs the raw error internally for debugging.
 */
export function sanitizeRpcError(raw: string): string {
  logger.debug({ rawError: raw }, "RPC simulation error (raw)");

  if (/contract.*not.*found|no such contract/i.test(raw)) {
    return "Contract not found on the specified network.";
  }
  if (/invalid xdr|failed to decode/i.test(raw)) {
    return "Invalid transaction XDR provided.";
  }
  if (/insufficient.*balance|account.*not.*found/i.test(raw)) {
    return "Source account not found or has insufficient balance.";
  }
  if (/exceeded.*instructions|cpu.*limit/i.test(raw)) {
    return "Transaction exceeded CPU instruction limit.";
  }
  if (/exceeded.*memory|memory.*limit/i.test(raw)) {
    return "Transaction exceeded memory limit.";
  }
  if (/host.*error|wasm.*trap/i.test(raw)) {
    return "Contract execution failed during simulation.";
  }
  if (/network.*timeout|connection.*refused|econnrefused/i.test(raw)) {
    return "RPC network error. Please try again.";
  }

  return raw;
}
