type LogLevel = "info" | "warn" | "error" | "debug";

function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
  base?: Record<string, unknown>,
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...base,
    ...meta,
  };
  const output = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  child: (base: Record<string, unknown>) => Logger;
};

function createLogger(base?: Record<string, unknown>): Logger {
  return {
    info: (message, meta) => log("info", message, meta, base),
    warn: (message, meta) => log("warn", message, meta, base),
    error: (message, meta) => log("error", message, meta, base),
    debug: (message, meta) => log("debug", message, meta, base),
    child: (extra) => createLogger({ ...base, ...extra }),
  };
}

export const logger = createLogger();
