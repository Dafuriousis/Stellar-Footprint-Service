import { Request, Response, NextFunction } from "express";

import { ErrorCode } from "../constants";

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
      res.status(504).json({
        success: false,
        error: "Request timed out",
        code: ErrorCode.REQUEST_TIMEOUT,
      });
    }
  }, TIMEOUT_MS);

  req.on("close", () => controller.abort());
  res.on("finish", () => clearTimeout(timer));
  next();
}
