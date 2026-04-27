import { logger } from "./logger";

/** Error codes considered transient network failures — safe to retry */
const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ENETUNREACH",
]);

/** Patterns in error messages that indicate a transient network issue */
const RETRYABLE_MESSAGE_PATTERNS = [
  /network.*timeout/i,
  /connection.*reset/i,
  /connection.*refused/i,
  /socket.*hang.*up/i,
  /econnreset/i,
  /etimedout/i,
];

/** Patterns that indicate simulation/validation errors — never retry these */
const NON_RETRYABLE_MESSAGE_PATTERNS = [
  /simulation.*error/i,
  /invalid.*xdr/i,
  /contract.*not.*found/i,
  /insufficient.*balance/i,
  /exceeded.*instructions/i,
  /exceeded.*memory/i,
  /host.*error/i,
  /wasm.*trap/i,
  /validation/i,
];

export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const msg = err.message ?? "";
  const code = (err as NodeJS.ErrnoException).code ?? "";

  // Never retry simulation/validation errors
  if (NON_RETRYABLE_MESSAGE_PATTERNS.some((p) => p.test(msg))) return false;

  // Retry on known error codes
  if (RETRYABLE_CODES.has(code)) return true;

  // Retry on known transient message patterns
  return RETRYABLE_MESSAGE_PATTERNS.some((p) => p.test(msg));
}

const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

const parsedMaxRetries = parseInt(
  process.env.RPC_MAX_RETRIES ?? String(DEFAULT_MAX_RETRIES),
  10,
);
export const RPC_MAX_RETRIES = Number.isFinite(parsedMaxRetries)
  ? parsedMaxRetries
  : DEFAULT_MAX_RETRIES;

/**
 * Executes `fn` with exponential backoff retry for transient RPC errors.
 * Delays: 100ms, 200ms, 400ms (doubles each attempt).
 * Never retries simulation or validation errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context = "rpc",
  maxRetries = RPC_MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= maxRetries || !isTransientError(err)) {
        throw err;
      }

      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
      logger.warn(
        {
          context,
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          error: (err as Error).message,
        },
        `Transient RPC error on attempt ${attempt + 1}/${maxRetries}, retrying in ${delayMs}ms`,
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
