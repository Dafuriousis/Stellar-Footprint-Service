import { Request, Response, NextFunction } from "express";
import { simulateTransaction } from "@services/simulator";
import { Network } from "@config/stellar";
import { getNetworkStatus } from "@services/networkStatus";
import metrics from "@middleware/metrics";
import { AppError } from "@utils/AppError";
import { simulateTransaction } from "../services/simulator";
import { buildRestoreTransaction } from "../services/restorer";
import { Network } from "../config/stellar";
import { getNetworkStatus } from "../services/networkStatus";
import metrics from "../middleware/metrics";
import { AppError } from "../utils/AppError";
<<<<<<< ours
import { ResponseEnvelope } from "../types";
=======
import { getCache } from "../services/cache";
>>>>>>> theirs
import {
  NETWORKS,
  DEFAULT_NETWORK,
  ERROR_MESSAGES,
  HTTP_STATUS,
  BATCH_MAX_SIZE,
} from "../constants";
<<<<<<< ours
import { version } from "../../package.json";
=======
import { createJob, deliverWebhook } from "../services/webhook";
>>>>>>> theirs

/**
 * Handle GET /api/health requests
 * Returns service liveness status for load balancers and uptime monitors
 * Does not require authentication
 */
export function health(req: Request, res: Response): void {
  res.status(HTTP_STATUS.OK).json({
    status: "ok",
    uptime: process.uptime(),
    version,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle POST /api/v1/simulate requests
 */
export async function simulate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { xdr, network } = req.body as { xdr?: string; network?: Network };

  if (!xdr) {
    return next(
      new AppError(ERROR_MESSAGES.MISSING_XDR, HTTP_STATUS.BAD_REQUEST),
    );
  }

  // Validate XDR is valid base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(xdr)) {
    return next(
      new AppError(
        "Invalid XDR: must be valid base64",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  // Enforce max XDR length (100kb)
  if (xdr.length > 100 * 1024) {
    return next(
      new AppError("XDR too large: maximum 100kb", HTTP_STATUS.BAD_REQUEST),
    );
  }

  if (network && network !== NETWORKS.MAINNET && network !== NETWORKS.TESTNET) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network =
    network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;

  metrics.incrementActiveSimulations();
  const start = Date.now();

  try {
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal);

    const duration = (Date.now() - start) / 1000;
    metrics.recordSimulation(net, result.success);
    metrics.recordSimulationDuration(net, duration);

    const response: ResponseEnvelope = result.success
      ? { success: true, data: result }
      : { success: false, error: result.error };

    res
      .status(
        result.success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY,
      )
      .json(result);
  } catch (err: unknown) {
      .json(response);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as { circuitOpen?: boolean; retryAfter?: number }).circuitOpen
    ) {
      const retryAfter =
        (err as unknown as { retryAfter: number }).retryAfter ?? 30;
      const response: ResponseEnvelope = {
        success: false,
        error: "Service temporarily unavailable due to high error rate",
      };
      res.status(503).set("Retry-After", String(retryAfter)).json(response);
      return;
    }

    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);

    if (
      message.toLowerCase().includes("rpc") ||
      message.toLowerCase().includes("connection")
    ) {
      metrics.recordRpcError(net, "connection_failure");
    }

    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  } finally {
    metrics.decrementActiveSimulations();
  }
}

<<<<<<< ours
/**
<<<<<<< ours
 * Handle GET /api/v1/network/status requests
=======
 * Handle POST /api/simulate/async requests
 * Accepts a webhookUrl, enqueues simulation, returns 202 with jobId
 */
export async function simulateAsync(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { xdr, network, webhookUrl } = req.body as {
    xdr?: string;
    network?: Network;
    webhookUrl?: string;
  };

  if (!xdr) {
    return next(new AppError(ERROR_MESSAGES.MISSING_XDR, HTTP_STATUS.BAD_REQUEST));
  }

  if (!webhookUrl) {
    return next(new AppError("Missing required field: webhookUrl", HTTP_STATUS.BAD_REQUEST));
  }

  if (
    network &&
    network !== NETWORKS.MAINNET &&
    network !== NETWORKS.TESTNET
  ) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network = network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;
  const jobId = createJob(webhookUrl);

  res.status(HTTP_STATUS.ACCEPTED).json({ jobId });

  // Run simulation and deliver webhook in background
  simulateTransaction(xdr, net, res.locals.abortSignal)
    .then((result) => deliverWebhook(jobId, result))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
      deliverWebhook(jobId, { success: false, error: message });
    });
}

/**
 * Handle GET /api/network/status requests
 * Returns current network information including latest ledger and RPC latency
 * @param req - Express request with optional network query parameter
 * @param res - Express response
 * @param next - Express next function for error handling
>>>>>>> theirs
 */
export async function networkStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const network = (req.query.network as Network) || DEFAULT_NETWORK;

  if (network !== NETWORKS.MAINNET && network !== NETWORKS.TESTNET) {
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

/**
 * Handle POST /api/v1/footprint/diff requests
 */
export async function footprintDiffController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { before, after } = req.body as {
    before?: unknown;
    after?: unknown;
  };

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

/**
 * Handle POST /api/v1/validate requests
 */
export async function validate(
  req: Request,
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

/**
 * Handle POST /api/v1/restore requests
 */
export async function restore(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { xdr, network } = req.body as { xdr?: string; network?: Network };

  if (!xdr) {
    return next(
      new AppError(ERROR_MESSAGES.MISSING_XDR, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network =
    network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;

  try {
    const result = await buildRestoreTransaction(xdr, net);
    const response: ResponseEnvelope = { success: true, data: result };
    res.status(HTTP_STATUS.OK).json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
=======
export async function footprintDiffController(
  req: Request,
  res: Response,
): Promise<void> {
  res.status(501).json({ error: "Not implemented" });
}

export async function validate(req: Request, res: Response): Promise<void> {
  res.status(501).json({ error: "Not implemented" });
>>>>>>> theirs
}

/**
 * Handle DELETE /api/cache requests
 * Flushes all entries from the active cache backend (Redis or in-memory)
 */
export async function invalidateCache(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cache = getCache();
    await cache.flush();
    res.status(HTTP_STATUS.OK).json({
      message: "Cache invalidated",
      backend: cache.backend,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

/**
 * Handle DELETE /api/cache requests
 * Flushes all entries from the active cache backend (Redis or in-memory)
 */
export async function invalidateCache(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cache = getCache();
    await cache.flush();
    res.status(HTTP_STATUS.OK).json({
      message: "Cache invalidated",
      backend: cache.backend,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}
