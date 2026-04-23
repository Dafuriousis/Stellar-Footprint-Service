import { Request, Response, NextFunction } from "express";

const TIMEOUT_MS = parseInt(process.env.SIMULATE_TIMEOUT_MS ?? "30000", 10);

export function timeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const controller = new AbortController();
  res.locals.abortSignal = controller.signal;

  const timer = setTimeout(() => {
    controller.abort();
    if (!res.headersSent) {
      res.set("Retry-After", String(Math.ceil(TIMEOUT_MS / 1000)));
      res.status(504).json({ error: "Request timed out" });
    }
  }, TIMEOUT_MS);

  res.on("finish", () => clearTimeout(timer));
  next();
}
