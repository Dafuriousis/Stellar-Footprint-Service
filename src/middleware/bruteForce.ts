import { Request, Response, NextFunction } from "express";

const DELAY_THRESHOLD = parseInt(
  process.env.BRUTE_FORCE_DELAY_THRESHOLD || "10",
);
const BLOCK_THRESHOLD = parseInt(
  process.env.BRUTE_FORCE_BLOCK_THRESHOLD || "20",
);
const WINDOW_MS = parseInt(process.env.BRUTE_FORCE_WINDOW_MS || "60000");
const DELAY_MS = parseInt(process.env.BRUTE_FORCE_DELAY_MS || "5000");
const BLOCK_MS = parseInt(process.env.BRUTE_FORCE_BLOCK_MS || "300000");

interface IpRecord {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

const ipRecords = new Map<string, IpRecord>();

export function recordFailure(ip: string): void {
  const now = Date.now();
  const record = ipRecords.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    ipRecords.set(ip, { count: 1, windowStart: now });
    return;
  }

  record.count += 1;

  if (record.count >= BLOCK_THRESHOLD) {
    record.blockedUntil = now + BLOCK_MS;
  }
}

export async function bruteForceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = ipRecords.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    return next();
  }

  if (record.blockedUntil && now < record.blockedUntil) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    res.status(429).json({
      error: "Too many failed requests. Try again later.",
      retryAfter,
    });
    return;
  }

  if (record.count >= DELAY_THRESHOLD) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  next();
}
