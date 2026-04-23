/**
 * Structured logger utility for the application.
 * This is the only file allowed to use console methods.
 */

export const logger = {
  debug: (message: string, data?: unknown) => {
    console.debug(`[debug] ${message}`, data);
  },
  info: (message: string, data?: unknown) => {
    console.info(`[info] ${message}`, data);
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[warn] ${message}`, data);
  },
  error: (message: string, error?: unknown) => {
    console.error(`[error] ${message}`, error);
  },
};
