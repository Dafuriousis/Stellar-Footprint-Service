import { logger } from "./logger";

/**
 * Maps known Stellar RPC error patterns to safe user-facing messages.
 * Strips stack traces, internal URLs, file paths, and provider-specific
 * identifiers before returning. Logs the raw error internally for debugging.
 */
export function sanitizeRpcError(raw: string): string {
  logger.debug({ rawError: raw }, "RPC simulation error (raw)");

  // Strip stack traces (lines starting with "at " or "Error:")
  let sanitized = raw
    .replace(/\n\s+at\s+.+/g, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  // Strip file paths (Unix and Windows)
  sanitized = sanitized.replace(/(?:\/[\w.\-/]+|[A-Za-z]:\\[\w.\-\\]+)/g, "");

  // Strip internal URLs (http/https with hostnames)
  sanitized = sanitized.replace(/https?:\/\/[^\s"')]+/g, "");

  // Strip provider-specific identifiers (e.g. API keys in path segments)
  sanitized = sanitized.replace(/\/v\d+\/[A-Za-z0-9_-]{20,}/g, "");

  sanitized = sanitized.trim();

  if (/contract.*not.*found|no such contract/i.test(sanitized)) {
    return "Contract not found on the specified network.";
  }
  if (/invalid xdr|failed to decode/i.test(sanitized)) {
    return "Invalid transaction XDR provided.";
  }
  if (/insufficient.*balance|account.*not.*found/i.test(sanitized)) {
    return "Source account not found or has insufficient balance.";
  }
  if (/exceeded.*instructions|cpu.*limit/i.test(sanitized)) {
    return "Transaction exceeded CPU instruction limit.";
  }
  if (/exceeded.*memory|memory.*limit/i.test(sanitized)) {
    return "Transaction exceeded memory limit.";
  }
  if (/host.*error|wasm.*trap/i.test(sanitized)) {
    return "Contract execution failed during simulation.";
  }
  if (/network.*timeout|connection.*refused|econnrefused/i.test(sanitized)) {
    return "RPC network error. Please try again.";
  }

  return sanitized || "An unexpected RPC error occurred.";
}
