import pino from "pino";

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: {
    paths: [
      "secretKey",
      "MAINNET_SECRET_KEY",
      "TESTNET_SECRET_KEY",
      "authorization",
      "password",
    ],
    censor: "[Redacted]",
  },
});
