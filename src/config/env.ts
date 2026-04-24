import { z } from "zod";
import { logger } from "../utils/logger";

// ── Schema ────────────────────────────────────────────────────────────────────

export const EnvSchema = z.object({
  // Required — RPC URLs for active network
  MAINNET_RPC_URL: z.string().url(),
  TESTNET_RPC_URL: z.string().url(),
  FUTURENET_RPC_URL: z.string().url(),

  // Required — secret keys (non-empty strings; format validated at use-site)
  MAINNET_SECRET_KEY: z.string().min(1),
  TESTNET_SECRET_KEY: z.string().min(1),
  FUTURENET_SECRET_KEY: z.string().min(1),

  // Required — active network selection
  NETWORK: z.enum(["mainnet", "testnet", "futurenet"]),

  // Optional with defaults
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SIMULATE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  COMPRESSION_THRESHOLD: z.coerce.number().int().nonnegative().default(1024),
  RPC_POOL_TTL_MS: z.coerce.number().int().positive().default(300000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  CACHE_MAX_SIZE: z.coerce.number().int().positive().default(500),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  REDIS_HOST: z.string().default("redis"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  GRAFANA_USER: z.string().default("admin"),
  GRAFANA_PASSWORD: z.string().default("admin"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

// ── Required field names ──────────────────────────────────────────────────────

const REQUIRED_FIELDS = new Set([
  "MAINNET_RPC_URL",
  "TESTNET_RPC_URL",
  "FUTURENET_RPC_URL",
  "MAINNET_SECRET_KEY",
  "TESTNET_SECRET_KEY",
  "FUTURENET_SECRET_KEY",
  "NETWORK",
]);

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates raw environment variables against EnvSchema.
 * - Required vars missing/invalid → logs aggregated error and calls process.exit(1).
 * - Optional vars with bad values → warns, substitutes default, continues.
 */
export function validateEnv(raw: NodeJS.ProcessEnv): EnvConfig {
  const result = EnvSchema.safeParse(raw);

  if (result.success) {
    return result.data;
  }

  const requiredErrors: z.ZodIssue[] = [];
  const optionalErrors: z.ZodIssue[] = [];

  for (const issue of result.error.issues) {
    const field = issue.path[0] as string;
    if (REQUIRED_FIELDS.has(field)) {
      requiredErrors.push(issue);
    } else {
      optionalErrors.push(issue);
    }
  }

  // Handle optional field errors: warn and strip so defaults apply
  if (optionalErrors.length > 0) {
    const strippedRaw = { ...raw };
    for (const issue of optionalErrors) {
      const field = issue.path[0] as string;
      logger.warn(
        { field, message: issue.message },
        `Optional env var ${field} is invalid: ${issue.message}. Using default.`,
      );
      delete strippedRaw[field];
    }

    // Re-parse without the invalid optional fields to get defaults
    const retryResult = EnvSchema.safeParse(strippedRaw);

    if (retryResult.success) {
      return retryResult.data;
    }

    // After stripping optionals, check again for required errors
    for (const issue of retryResult.error.issues) {
      const field = issue.path[0] as string;
      if (REQUIRED_FIELDS.has(field)) {
        requiredErrors.push(issue);
      }
    }
  }

  // Handle required field errors: aggregate and exit
  if (requiredErrors.length > 0) {
    const lines = requiredErrors.map(
      (issue) => `  ${String(issue.path[0])}: ${issue.message}`,
    );
    const message = [
      "Environment validation failed. Fix the following errors:",
      ...lines,
    ].join("\n");

    logger.error(message);
    process.exit(1);
  }

  // Should not reach here, but satisfy TypeScript
  /* istanbul ignore next */
  throw new Error("Unexpected validation state");
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const env: EnvConfig = validateEnv(process.env);
