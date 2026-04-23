type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Structured logger utility using JSON output for production-readiness.
 * Outputs to stdout/stderr using process streams to bypass console buffer.
 */
function log(level: LogLevel, message: string, data?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && typeof data === "object" ? data : { data }),
  };
  const output = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
  debug: (message: string, data?: unknown) => log("debug", message, data),
};
