import { Request, Response, NextFunction } from "express";

export function responseTimeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();

  const originalSend = res.send;
  res.send = function (data: unknown) {
    const duration = Date.now() - startTime;
    res.set("X-Response-Time", `${duration.toFixed(2)}ms`);
    return originalSend.call(this, data);
  };

  next();
}
