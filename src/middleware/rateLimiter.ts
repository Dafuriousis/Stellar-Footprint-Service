import rateLimit from "express-rate-limit";

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "60", 10);
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || "60000",
  10,
);

export const simulateRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true, // sets X-RateLimit-Limit and X-RateLimit-Remaining
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    res.setHeader("Retry-After", retryAfter);
    res.status(429).json({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    });
  },
});
