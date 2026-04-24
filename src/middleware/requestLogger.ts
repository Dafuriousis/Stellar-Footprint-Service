import { Request, Response, NextFunction } from "express";

import { logger } from "../utils/logger";

const isDebug = process.env.LOG_LEVEL === "debug";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = res.locals["requestId"] as string | undefined;
  const reqLogger = requestId ? logger.child({ requestId }) : logger;

  if (isDebug && req.body && Object.keys(req.body as object).length > 0) {
    const logged: Record<string, unknown> = { ...(req.body as object) };
    if (typeof logged["xdr"] === "string" && logged["xdr"].length > 50) {
      logged["xdr"] = `${logged["xdr"].slice(0, 50)}...`;
    }
    reqLogger.debug(logged, `${req.method} ${req.path}`);
  }

  res.on("finish", () => {
    reqLogger.info(
      {
        status: res.statusCode,
        method: req.method,
        path: req.path,
      },
      `${req.method} ${req.path}`,
    );
  });

  next();
}
