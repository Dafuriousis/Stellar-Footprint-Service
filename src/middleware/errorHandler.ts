import { Request, Response, NextFunction } from "express";

import { Translations, getTranslations } from "../i18n";
import { en } from "../i18n/en";
import { ResponseEnvelope } from "../types";
import { AppError } from "../utils/AppError";

interface CircuitOpenError extends Error {
  circuitOpen: true;
  retryAfter: number;
}

function isCircuitOpenError(err: unknown): err is CircuitOpenError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as CircuitOpenError).circuitOpen === true
  );
}

/** Build a reverse map from English message value → translation key */
const enValueToKey = Object.fromEntries(
  Object.entries(en).map(([k, v]) => [v, k]),
) as Record<string, keyof Translations>;

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const t = getTranslations(req.headers["accept-language"]);

  if (isCircuitOpenError(err)) {
    res.set("Retry-After", String(err.retryAfter));
    res.status(503).json({
      success: false,
      error: t.CIRCUIT_OPEN,
      ...(res.locals.requestId ? { requestId: res.locals.requestId as string } : {}),
    } satisfies ResponseEnvelope & { requestId?: string });
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const rawMessage =
    err instanceof AppError ? err.message : "Internal server error";

  const key = enValueToKey[rawMessage];
  const message = key ? (t[key] as string) : rawMessage;

  const response: ResponseEnvelope & { requestId?: string } = {
    success: false,
    error: message,
    ...(res.locals.requestId ? { requestId: res.locals.requestId as string } : {}),
  };

  res.status(statusCode).json(response);
}
