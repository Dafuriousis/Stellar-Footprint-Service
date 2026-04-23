type LogLevel = "info" | "warn" | "error" | "debug";

<<<<<<< ours
/**
 * Structured logger utility using JSON output for production-readiness.
 * Outputs to stdout/stderr using process streams to bypass console buffer.
 */
function log(level: LogLevel, message: string, data?: unknown) {
=======
function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
>>>>>>> theirs
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
<<<<<<< ours
    ...(data && typeof data === "object" ? data : { data }),
=======
    ...meta,
>>>>>>> theirs
  };
  const output = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

export const logger = {
<<<<<<< ours
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
  debug: (message: string, data?: unknown) => log("debug", message, data),
=======
  info: (message: string, meta?: Record<string, unknown>) =>
    log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    log("error", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) =>
    log("debug", message, meta),
>>>>>>> theirs
};
