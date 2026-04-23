import { Request, Response, NextFunction } from "express";

const isDebug = process.env.LOG_LEVEL === "debug";

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  if (isDebug && req.body && Object.keys(req.body).length > 0) {
    const logged: Record<string, unknown> = { ...req.body };
    if (typeof logged.xdr === "string" && logged.xdr.length > 50) {
      logged.xdr = `${logged.xdr.slice(0, 50)}...`;
    }
    console.debug(`[debug] ${req.method} ${req.path}`, logged);
  }
  next();
}
