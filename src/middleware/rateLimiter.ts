import rateLimit from "express-rate-limit";

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "60", 10);
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || "60000",
  10,
);

function makeLimiter(max: number, windowMs: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: true,
    handler: (_req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    },
  });
}

export const simulateRateLimiter = makeLimiter(
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
);

export const decodeRateLimiter = makeLimiter(
  parseInt(process.env.DECODE_RATE_LIMIT_MAX || "120", 10),
  parseInt(process.env.DECODE_RATE_LIMIT_WINDOW_MS || "60000", 10),
);

export const feeRateLimiter = makeLimiter(
  parseInt(process.env.FEE_RATE_LIMIT_MAX || "60", 10),
  parseInt(process.env.FEE_RATE_LIMIT_WINDOW_MS || "60000", 10),
);
