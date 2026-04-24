import pinoHttp from "pino-http";
import { logger } from "../utils/logger";

export const requestLogger = pinoHttp({
  logger,
  // Attach requestId from res.locals if set by requestIdMiddleware
  genReqId(req, res) {
    return (res.locals as Record<string, unknown>).requestId as string;
  },
  customLogLevel(_req, res) {
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req) {
      const body = req.raw?.body as Record<string, unknown> | undefined;
      const sanitized = body ? { ...body } : undefined;
      if (sanitized && typeof sanitized.xdr === "string" && sanitized.xdr.length > 50) {
        sanitized.xdr = `${sanitized.xdr.slice(0, 50)}...`;
      }
      return {
        method: req.method,
        url: req.url,
        ...(sanitized && logger.level === "debug" ? { body: sanitized } : {}),
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
