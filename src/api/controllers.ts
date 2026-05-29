import fs from "fs";
import path from "path";

import { Network } from "@config/stellar";
import metrics from "@middleware/metrics";
import { getCache } from "@services/cache";
import { decodeXdr, type XdrType } from "@services/decoder";
import { estimateFee, estimateFeeDetailed } from "@services/feeEstimator";
import { getNetworkStatus } from "@services/networkStatus";
import { buildRestoreTransaction } from "@services/restorer";
import { simulateTransaction } from "@services/simulator";
import { AppError } from "@utils/AppError";
import { rpcCircuitBreaker } from "@utils/circuitBreaker";
import { validateXdrInput } from "@utils/validateXdrInput";
import { Request, Response, NextFunction } from "express";

import { version } from "../../package.json";
import { env } from "../config/env";
import {
  NETWORKS,
  DEFAULT_NETWORK,
  ERROR_MESSAGES,
  HTTP_STATUS,
  BATCH_MAX_SIZE,
  ErrorCode,
  getErrorCodeByMessage,
} from "../constants";
import { ResponseEnvelope } from "../types";
import { validateXdrInput } from "../utils/validateXdrInput";

export function supportedNetworks(_req: Request, res: Response): void {
  const networks: string[] = [];
  if (process.env.TESTNET_RPC_URL) networks.push("testnet");
  if (process.env.MAINNET_RPC_URL) networks.push("mainnet");
  if (process.env.FUTURENET_RPC_URL) networks.push("futurenet");
  res.status(HTTP_STATUS.OK).json({ networks });
}

export function health(_req: Request, res: Response): void {
  res.status(HTTP_STATUS.OK).json({
    status: "ok",
    uptime: process.uptime(),
    version,
    timestamp: new Date().toISOString(),
  });
}

export function liveness(_req: Request, res: Response): void {
  res.status(HTTP_STATUS.OK).json({
    status: "ok",
    uptime: process.uptime(),
    version,
    timestamp: new Date().toISOString(),
  });
}

export async function readiness(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const checks: Record<string, { status: string; details?: unknown }> = {};

    // Check Redis/Cache
    try {
      const cache = getCache();
      const testKey = "__health_check__";
      const testValue = Date.now().toString();
      await cache.set(testKey, testValue, 5000);
      const retrieved = await cache.get<string>(testKey);
      await cache.delete(testKey);

      checks.cache = {
        status: retrieved === testValue ? "healthy" : "unhealthy",
        details: { backend: cache.backend },
      };
    } catch (err) {
      checks.cache = {
        status: "unhealthy",
        details: { error: (err as Error).message },
      };
    }

    // Check RPC Circuit Breaker
    const cbState = rpcCircuitBreaker.getState();
    checks.rpcCircuitBreaker = {
      status: cbState.state === "open" ? "unhealthy" : "healthy",
      details: cbState,
    };

    // Determine overall health
    const allHealthy = Object.values(checks).every(
      (check) => check.status === "healthy",
    );

    if (allHealthy) {
      res.status(HTTP_STATUS.OK).json({
        status: "ready",
        checks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: "not ready",
        checks,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function simulate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { xdr, network, ledgerSequence } = req.body as {
    xdr?: string;
    network?: Network;
    ledgerSequence?: number;
  };

  const xdrCheck = validateXdrInput(xdr);
  if (!xdrCheck.valid) {
    return next(new AppError(xdrCheck.error!, HTTP_STATUS.BAD_REQUEST));
  }

  const xdrValue = xdr as string;

  if (network && network !== NETWORKS.MAINNET && network !== NETWORKS.TESTNET) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  if (ledgerSequence !== undefined) {
    if (!Number.isInteger(ledgerSequence) || ledgerSequence <= 0) {
      return next(
        new AppError(
          ERROR_MESSAGES.INVALID_LEDGER_SEQUENCE,
          HTTP_STATUS.BAD_REQUEST,
        ),
      );
    }
  }

  const net: Network = (network as Network) || DEFAULT_NETWORK;

  metrics.incrementActiveSimulations();
  const start = Date.now();

  // Record XDR payload size (decoded byte length)
  try {
    metrics.recordXdrBytes(Buffer.from(xdr!, "base64").length);
  } catch {
    // ignore — never block the request for a metrics failure
  }

  try {
    const result = await simulateTransaction(
      xdr!,
      net,
      res.locals.abortSignal,
      ledgerSequence,
    );
    const duration = (Date.now() - start) / 1000;
    metrics.recordSimulation(net, result.success);
    metrics.recordSimulationDuration(net, duration);

    const resultWithCode = result.success
      ? result
      : {
          ...result,
          code:
            result.code ??
            getErrorCodeByMessage(
              result.error ?? ERROR_MESSAGES.UNEXPECTED_ERROR,
              HTTP_STATUS.UNPROCESSABLE_ENTITY,
            ),
        };

    res.setHeader("X-Cache", result.cacheHit ? "HIT" : "MISS");
    res
      .status(
        resultWithCode.success
          ? HTTP_STATUS.OK
          : HTTP_STATUS.UNPROCESSABLE_ENTITY,
      )
      .json(resultWithCode);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  } finally {
    metrics.decrementActiveSimulations();
  }
}

export async function simulateBatch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { transactions, network } = req.body as {
    transactions?: { xdr: string }[];
    network?: Network;
  };

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return next(
      new AppError(
        "Missing required field: transactions (must be a non-empty array)",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  if (transactions.length > BATCH_MAX_SIZE) {
    return next(
      new AppError(
        `Batch size exceeds maximum of ${BATCH_MAX_SIZE} transactions`,
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  if (
    network &&
    network !== NETWORKS.MAINNET &&
    network !== NETWORKS.TESTNET &&
    network !== NETWORKS.FUTURENET
  ) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network = (network as Network) || DEFAULT_NETWORK;
  const concurrency = env.BATCH_CONCURRENCY;

  metrics.incrementActiveSimulations();

  try {
    const tasks = transactions.map(({ xdr }, index) => () => {
      if (!xdr) return Promise.reject(new Error(ERROR_MESSAGES.MISSING_XDR));
      return simulateTransaction(
        xdr as string,
        net,
        res.locals.abortSignal,
      ).then((result) => ({ index, ...result }));
    });

    const settled: PromiseSettledResult<{
      index: number;
      success: boolean;
      cacheHit?: boolean;
    }>[] = [];
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, i + concurrency).map((t) => t());
      settled.push(...(await Promise.allSettled(chunk)));
    }

    const results = settled.map((outcome, index) => {
      if (outcome.status === "fulfilled") {
        const value = outcome.value as {
          index: number;
          success: boolean;
          [key: string]: unknown;
        };
        metrics.recordSimulation(net, value.success);
        return value;
      } else {
        metrics.recordSimulation(net, false);
        const message =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : ERROR_MESSAGES.UNEXPECTED_ERROR;
        return {
          index,
          success: false,
          error: message,
          code: getErrorCodeByMessage(
            message,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ),
        };
      }
    });

    const anyHit = results.some((r) => "cacheHit" in r && r.cacheHit);
    const allHit = results.every((r) => "cacheHit" in r && r.cacheHit);
    res.setHeader("X-Cache", allHit ? "HIT" : anyHit ? "PARTIAL" : "MISS");
    res.status(HTTP_STATUS.OK).json({ results });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  } finally {
    metrics.decrementActiveSimulations();
  }
}

export async function networkStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const network = (req.query.network as Network) || DEFAULT_NETWORK;

  if (
    network !== NETWORKS.MAINNET &&
    network !== NETWORKS.TESTNET &&
    network !== NETWORKS.FUTURENET
  ) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  try {
    const status = await getNetworkStatus(network);
    const response: ResponseEnvelope = { success: true, data: status };
    res.status(HTTP_STATUS.OK).json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

export async function footprintDiffController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { before, after } = req.body as { before?: unknown; after?: unknown };

  if (!before || !after) {
    return next(
      new AppError(
        "Missing required fields: before and after",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  try {
    const response: ResponseEnvelope = {
      success: true,
      data: { message: "Not fully implemented" },
    };
    res.status(HTTP_STATUS.OK).json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

export async function validate(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const response: ResponseEnvelope = {
      success: true,
      data: { message: "Not implemented" },
    };
    res.status(HTTP_STATUS.OK).json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

export async function restore(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { xdr, network } = req.body as { xdr?: string; network?: Network };

  const xdrCheck = validateXdrInput(xdr);
  if (!xdrCheck.valid) {
    return next(new AppError(xdrCheck.error!, HTTP_STATUS.BAD_REQUEST));
  }

  const net: Network =
    network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;

  try {
    const result = await buildRestoreTransaction(xdr!, net);
    const response: ResponseEnvelope = { success: true, data: result };
    res.status(HTTP_STATUS.OK).json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

export async function invalidateCache(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cache = getCache();
    await cache.flush();
    res
      .status(HTTP_STATUS.OK)
      .json({ message: "Cache invalidated", backend: cache.backend });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

export async function estimateFeeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { cpuInsns, memBytes, network } = req.body as {
    cpuInsns?: string;
    memBytes?: string;
    network?: Network;
  };

  if (!cpuInsns || !memBytes) {
    return next(
      new AppError(
        "Missing required fields: cpuInsns and memBytes",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  if (!/^\d+$/.test(cpuInsns) || !/^\d+$/.test(memBytes)) {
    return next(
      new AppError(
        "cpuInsns and memBytes must be non-negative integer strings",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  if (
    network &&
    network !== NETWORKS.MAINNET &&
    network !== NETWORKS.TESTNET &&
    network !== NETWORKS.FUTURENET
  ) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network = (network as Network) || DEFAULT_NETWORK;

  try {
    const result = await estimateFee(cpuInsns, memBytes, net);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

export function decode(req: Request, res: Response, next: NextFunction): void {
  const { xdr, type = "transaction" } = req.query as {
    xdr?: string;
    type?: string;
  };

  const xdrCheck = validateXdrInput(xdr);
  if (!xdrCheck.valid) {
    return next(new AppError(xdrCheck.error!, HTTP_STATUS.BAD_REQUEST));
  }

  const validTypes: XdrType[] = ["transaction", "operation", "ledger_key"];
  if (!validTypes.includes(type as XdrType)) {
    return next(
      new AppError(
        `Invalid type. Supported types: ${validTypes.join(", ")}`,
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  const result = decodeXdr(xdr!, type as XdrType);

  if (!result.success) {
    return next(
      new AppError(
        result.error ?? "Failed to decode XDR",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  res.status(HTTP_STATUS.OK).json(result);
}

export async function costBreakdownController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { cpuInsns, memBytes, network } = req.query as {
    cpuInsns?: string;
    memBytes?: string;
    network?: string;
  };

  if (!cpuInsns || !memBytes) {
    return next(
      new AppError(
        "Missing required query parameters: cpuInsns and memBytes",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  if (!/^\d+$/.test(cpuInsns) || !/^\d+$/.test(memBytes)) {
    return next(
      new AppError(
        "cpuInsns and memBytes must be non-negative integer strings",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  if (
    network &&
    network !== NETWORKS.MAINNET &&
    network !== NETWORKS.TESTNET &&
    network !== NETWORKS.FUTURENET
  ) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network = (network as Network) || DEFAULT_NETWORK;

  try {
    const result = await estimateFeeDetailed(cpuInsns, memBytes, net);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

export function openApiSpec(req: Request, res: Response): void {
  const fs = require("fs") as typeof import("fs");
  const YAML = require("yaml") as { parse: (s: string) => unknown };
  const specPath = path.join(__dirname, "..", "..", "openapi.yaml");
  if (!fs.existsSync(specPath)) {
    res.status(404).json({
      success: false,
      error: "OpenAPI spec not found",
      code: ErrorCode.OPENAPI_SPEC_NOT_FOUND,
    });
    return;
  }
  res.json(YAML.parse(fs.readFileSync(specPath, "utf8")));
}
