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
import { estimateFee } from "../services/feeEstimator";
import metrics from "../middleware/metrics";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { AppError } from "../utils/AppError";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { ResponseEnvelope } from "../types";
=======
import { getCache } from "../services/cache";
>>>>>>> theirs
=======
import { decodeXdr, type XdrType } from "../services/decoder";
>>>>>>> theirs
=======
import { decodeXdr, type XdrType } from "../services/decoder";
>>>>>>> theirs
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
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { version } from "../../package.json";
=======
import { createJob, deliverWebhook } from "../services/webhook";
>>>>>>> theirs
=======
import { version } from "../../package.json";
=======
import { version } from "../../package.json";
=======
import { version } from "../../package.json";
=======
import { ResponseEnvelope } from "../types";
>>>>>>> theirs
=======
import { ResponseEnvelope } from "../types";
>>>>>>> theirs
=======
import { recordFailure } from "../middleware/bruteForce";
>>>>>>> theirs

<<<<<<< ours
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
=======
import * as StellarSdk from "@stellar/stellar-sdk";

export async function simulate(req: Request, res: Response): Promise<void> {
<<<<<<< ours
  const { xdr, network, dryRun } = req.body as {
    xdr?: string;
    network?: Network;
    dryRun?: boolean;
  };
>>>>>>> theirs

  if (!xdr) {
<<<<<<< ours
<<<<<<< ours
    return next(
      new AppError(ERROR_MESSAGES.MISSING_XDR, HTTP_STATUS.BAD_REQUEST),
    );
  }

<<<<<<< ours
<<<<<<< ours
  // Validate XDR is valid base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(xdr)) {
<<<<<<< ours
    return next(
      new AppError(
        "Invalid XDR: must be valid base64",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
=======
    res.status(400).json({ error: "Invalid XDR: must be valid base64" });
    return;
  }

  // Enforce max XDR length (100kb)
  if (xdr.length > 100 * 1024) {
    res.status(400).json({ error: "XDR too large: maximum 100kb" });
    return;
  }

  // Validate XDR is valid base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(xdr)) {
    res.status(400).json({ error: "Invalid XDR: must be valid base64" });
    return;
  }

  // Enforce max XDR length (100kb)
  if (xdr.length > 100 * 1024) {
    res.status(400).json({ error: "XDR too large: maximum 100kb" });
=======
    const response: ResponseEnvelope = { success: false, error: "Missing required field: xdr" };
    res.status(400).json(response);
>>>>>>> theirs
=======
export async function simulate(req: Request, res: Response): Promise<void> {
  const { xdr, network, ledgerSequence } = req.body as {
    xdr?: string;
    network?: Network;
    ledgerSequence?: number;
  };

  if (!xdr) {
<<<<<<< ours
=======
    recordFailure(req.ip || req.socket.remoteAddress || "unknown");
>>>>>>> theirs
    res.status(400).json({ error: "Missing required field: xdr" });
>>>>>>> theirs
=======
    const response: ResponseEnvelope = { success: false, error: "Missing required field: xdr" };
    res.status(400).json(response);
>>>>>>> theirs
    return;
  }

  // Validate XDR is valid base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(xdr)) {
    res.status(400).json({ error: "Invalid XDR: must be valid base64" });
    return;
  }

  // Enforce max XDR length (100kb)
  if (xdr.length > 100 * 1024) {
    res.status(400).json({ error: "XDR too large: maximum 100kb" });
    return;
  }

  // Validate XDR is valid base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(xdr)) {
    res.status(400).json({ error: "Invalid XDR: must be valid base64" });
    return;
  }

  // Enforce max XDR length (100kb)
  if (xdr.length > 100 * 1024) {
    res.status(400).json({ error: "XDR too large: maximum 100kb" });
=======
  const { xdr, network } = req.body as { xdr?: string; network?: Network };

  if (!xdr) {
    res.status(400).json({ error: "Missing required field: xdr" });
>>>>>>> theirs
    return;
  }

  // Validate network parameter
  if (network && network !== "mainnet" && network !== "testnet") {
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
>>>>>>> theirs
    const response: ResponseEnvelope = {
      success: false,
      error: "Invalid network. Use 'testnet' or 'mainnet'",
    };
    res.status(400).json(response);
<<<<<<< ours
=======
    res.status(400).json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
>>>>>>> theirs
=======
>>>>>>> theirs
    return;
>>>>>>> theirs
  }

<<<<<<< ours
  // Enforce max XDR length (100kb)
  if (xdr.length > 100 * 1024) {
    return next(
      new AppError("XDR too large: maximum 100kb", HTTP_STATUS.BAD_REQUEST),
    );
  }

=======
>>>>>>> theirs
=======
>>>>>>> theirs
  if (network && network !== NETWORKS.MAINNET && network !== NETWORKS.TESTNET) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network =
    network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;
=======
  // Validate ledgerSequence if provided
  if (ledgerSequence !== undefined && (!Number.isInteger(ledgerSequence) || ledgerSequence <= 0)) {
    res.status(400).json({ error: "Invalid ledgerSequence. Must be a positive integer." });
=======
    recordFailure(req.ip || req.socket.remoteAddress || "unknown");
    res
      .status(400)
      .json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
>>>>>>> theirs
=======
    res
      .status(400)
      .json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
>>>>>>> theirs
=======
    res
      .status(400)
      .json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
>>>>>>> theirs
=======
    res
      .status(400)
      .json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
>>>>>>> theirs
=======
    res.status(400).json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
>>>>>>> theirs
    return;
  }

  const net: Network = network === "mainnet" ? "mainnet" : "testnet";
>>>>>>> theirs

<<<<<<< ours
=======
  // Dry-run: parse XDR locally, skip RPC
  if (dryRun) {
    try {
      const passphrase =
        net === "mainnet"
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET;
      const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, passphrase);
      const ops =
        tx instanceof StellarSdk.FeeBumpTransaction
          ? tx.innerTransaction.operations
          : tx.operations;
      res.status(200).json({
        valid: true,
        operationCount: ops.length,
        operationType: ops[0]?.type ?? "unknown",
        network: net,
      });
    } catch (err: unknown) {
      res.status(400).json({
        valid: false,
        error: err instanceof Error ? err.message : "Failed to parse XDR",
      });
    }
    return;
  }

  // Track active simulations
>>>>>>> theirs
  metrics.incrementActiveSimulations();
  const start = Date.now();

  try {
<<<<<<< ours
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal);

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
    const duration = (Date.now() - start) / 1000;
<<<<<<< ours
    metrics.recordSimulation(net, result.success);
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
    metrics.recordSimulationDuration(net, duration);

    const response: ResponseEnvelope = result.success
      ? { success: true, data: result }
      : { success: false, error: result.error };

<<<<<<< ours
=======
    res.setHeader("X-Cache", result.cacheHit ? "HIT" : "MISS");
>>>>>>> theirs
=======
    res.setHeader("X-Cache", result.cacheHit ? "HIT" : "MISS");
>>>>>>> theirs
=======
    res.setHeader("X-Cache", result.cacheHit ? "HIT" : "MISS");
>>>>>>> theirs
    res
      .status(
        result.success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY,
      )
      .json(result);
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
>>>>>>> theirs
  } catch (err: unknown) {
      .json(response);
=======
    const response: ResponseEnvelope = result.success
      ? { success: true, data: result }
      : { success: false, error: result.error };

    res.status(result.success ? 200 : 422).json(response);
>>>>>>> theirs
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

=======
  } catch (err: unknown) {
=======
  } catch (err: unknown) {
>>>>>>> theirs
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  } finally {
    metrics.decrementActiveSimulations();
  }
}

<<<<<<< ours
/**
 * Handle POST /api/simulate/batch requests
 * Simulates up to BATCH_MAX_SIZE transactions in parallel, returning per-item results.
 * Partial failures do not fail the whole batch.
 * @param req - Express request with transactions array and optional network in body
 * @param res - Express response
 * @param next - Express next function for error handling
 */
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

  if (network && network !== NETWORKS.MAINNET && network !== NETWORKS.TESTNET) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }
=======

=======
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal, ledgerSequence);
    
>>>>>>> theirs
    // Record simulation metrics
    metrics.recordSimulation(net, result.success);
<<<<<<< ours
    metrics.recordSimulationDuration(net, duration);
>>>>>>> theirs

  const net: Network =
    network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;

  metrics.incrementActiveSimulations();

  try {
    const settled = await Promise.allSettled(
      transactions.map(({ xdr }, index) => {
        if (!xdr) {
          return Promise.reject(new Error(ERROR_MESSAGES.MISSING_XDR));
        }
        return simulateTransaction(xdr, net, res.locals.abortSignal).then(
          (result) => ({ index, ...result }),
        );
      }),
    );

    const results = settled.map((outcome, index) => {
      if (outcome.status === "fulfilled") {
        metrics.recordSimulation(net, outcome.value.success);
        return outcome.value;
      } else {
        metrics.recordSimulation(net, false);
        const message =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : ERROR_MESSAGES.UNEXPECTED_ERROR;
        return { index, success: false, error: message };
      }
    });

<<<<<<< ours
    const anyHit = results.some((r) => "cacheHit" in r && r.cacheHit);
    const allHit = results.every((r) => "cacheHit" in r && r.cacheHit);
    res.setHeader("X-Cache", allHit ? "HIT" : anyHit ? "PARTIAL" : "MISS");
    res.status(HTTP_STATUS.OK).json({ results });
=======
    // Record simulation metrics
    metrics.recordSimulation(net, result.success);

    if (!result.success) {
      recordFailure(req.ip || req.socket.remoteAddress || "unknown");
    }
=======
    // Record simulation metrics
    metrics.recordSimulation(net, result.success);
>>>>>>> theirs
=======
    // Record simulation metrics
    metrics.recordSimulation(net, result.success);
>>>>>>> theirs
=======
    // Record simulation metrics
    metrics.recordSimulation(net, result.success);
>>>>>>> theirs
=======
    const duration = (Date.now() - start) / 1000;

    // Record simulation metrics
    metrics.recordSimulation(net, result.success);
    metrics.recordSimulationDuration(net, duration);
>>>>>>> theirs

    res.status(result.success ? 200 : 422).json(result);
>>>>>>> theirs
=======
    
    const { raw, ...clientResult } = result;
    res.status(result.success ? 200 : 422).json(clientResult);
>>>>>>> theirs
  } catch (err: unknown) {
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
=======
    const response: ResponseEnvelope = result.success
      ? { success: true, data: result }
      : { success: false, error: result.error };

    res.status(result.success ? 200 : 422).json(response);
>>>>>>> theirs
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
=======
    const response: ResponseEnvelope = { success: false, error: message };
    res.status(500).json(response);
>>>>>>> theirs
  } finally {
    metrics.decrementActiveSimulations();
  }
}
=======
    // Handle circuit breaker open state
    if (
      err instanceof Error &&
      (err as { circuitOpen?: boolean; retryAfter?: number }).circuitOpen
    ) {
      const retryAfter =
        (err as unknown as { retryAfter: number }).retryAfter ?? 30;
      res
        .status(503)
        .set("Retry-After", String(retryAfter))
        .json({ error: "Service temporarily unavailable", retryAfter });
      return;
    }

    const message = err instanceof Error ? err.message : "Unexpected error";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs

/**
 * Handle POST /api/simulate/batch requests
 * Simulates up to BATCH_MAX_SIZE transactions in parallel, returning per-item results.
 * Partial failures do not fail the whole batch.
 * @param req - Express request with transactions array and optional network in body
 * @param res - Express response
 * @param next - Express next function for error handling
 */
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

  if (network && network !== NETWORKS.MAINNET && network !== NETWORKS.TESTNET) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network =
    network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;

  metrics.incrementActiveSimulations();

  try {
    const settled = await Promise.allSettled(
      transactions.map(({ xdr }, index) => {
        if (!xdr) {
          return Promise.reject(new Error(ERROR_MESSAGES.MISSING_XDR));
        }
        return simulateTransaction(xdr, net, res.locals.abortSignal).then(
          (result) => ({ index, ...result }),
        );
      }),
    );

    const results = settled.map((outcome, index) => {
      if (outcome.status === "fulfilled") {
        metrics.recordSimulation(net, outcome.value.success);
        return outcome.value;
      } else {
        metrics.recordSimulation(net, false);
        const message =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : ERROR_MESSAGES.UNEXPECTED_ERROR;
        return { index, success: false, error: message };
      }
    });

    const anyHit = results.some((r) => "cacheHit" in r && r.cacheHit);
    const allHit = results.every((r) => "cacheHit" in r && r.cacheHit);
    res.setHeader("X-Cache", allHit ? "HIT" : anyHit ? "PARTIAL" : "MISS");
    res.status(HTTP_STATUS.OK).json({ results });
  } catch (err: unknown) {
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);

<<<<<<< ours
<<<<<<< ours
    if (
      message.toLowerCase().includes("rpc") ||
      message.toLowerCase().includes("connection")
    ) {
      metrics.recordRpcError(net, "connection_failure");
    }

    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
=======
    // Record RPC error if applicable
    if (message.toLowerCase().includes('rpc') || message.toLowerCase().includes('connection')) {
        metrics.recordRpcError(net, 'connection_failure');
    }
=======

    // Record failed simulation
    metrics.recordSimulation(net, false);
    recordFailure(req.ip || req.socket.remoteAddress || "unknown");
>>>>>>> theirs
=======

    // Record failed simulation
    metrics.recordSimulation(net, false);
>>>>>>> theirs
=======

    // Record failed simulation
    metrics.recordSimulation(net, false);
>>>>>>> theirs
=======

    // Record failed simulation
    metrics.recordSimulation(net, false);
>>>>>>> theirs

    // Record RPC error if applicable
    if (message.toLowerCase().includes('rpc') || message.toLowerCase().includes('connection')) {
        metrics.recordRpcError(net, 'connection_failure');
    }

    res.status(500).json({ error: message });
>>>>>>> theirs
=======
    const response: ResponseEnvelope = { success: false, error: message };
    res.status(500).json(response);
>>>>>>> theirs
  } finally {
    metrics.decrementActiveSimulations();
  }
}

<<<<<<< ours
<<<<<<< ours
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

<<<<<<< ours
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

<<<<<<< ours
=======
>>>>>>> theirs
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

=======
>>>>>>> theirs
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
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
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
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

/**
 * Handle POST /api/estimate-fee requests
 * Calculates the recommended resource fee from simulation cost output
 * @param req - Express request with cpuInsns, memBytes, and optional network in body
 * @param res - Express response
 * @param next - Express next function for error handling
 */
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

  if (network && network !== NETWORKS.MAINNET && network !== NETWORKS.TESTNET) {
    return next(
      new AppError(ERROR_MESSAGES.INVALID_NETWORK, HTTP_STATUS.BAD_REQUEST),
    );
  }

  const net: Network =
    network === NETWORKS.MAINNET ? NETWORKS.MAINNET : DEFAULT_NETWORK;

  try {
    const result = await estimateFee(cpuInsns, memBytes, net);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

/**
<<<<<<< ours
 * Handle GET /api/decode requests
 * Decodes a base64 XDR string into a human-readable JSON representation
 * without simulating the transaction. Useful for debugging.
 * @param req - Express request with xdr and optional type query parameters
 * @param res - Express response
 * @param next - Express next function for error handling
 */
export function decode(req: Request, res: Response, next: NextFunction): void {
  const { xdr, type = "transaction" } = req.query as {
    xdr?: string;
    type?: string;
  };

  if (!xdr) {
    return next(
      new AppError(ERROR_MESSAGES.MISSING_XDR, HTTP_STATUS.BAD_REQUEST),
    );
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

  const result = decodeXdr(xdr, type as XdrType);

  if (!result.success) {
<<<<<<< ours
    return next(
      new AppError(
        result.error ?? "Failed to decode XDR",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
=======
    return next(new AppError(result.error ?? "Failed to decode XDR", HTTP_STATUS.BAD_REQUEST));
>>>>>>> theirs
  }

  res.status(HTTP_STATUS.OK).json(result);
=======
=======
>>>>>>> theirs
export async function footprintDiffController(req: Request, res: Response): Promise<void> {
  const { before, after } = req.body as {
    before?: {
      footprint?: {
        readOnly: any[];
        readWrite: any[];
      } | null
    };
    after?: {
      footprint?: {
        readOnly: any[];
        readWrite: any[];
      } | null
    };
  };

  if (!before || !after) {
    res.status(400).json({ error: "Missing required fields: before and after" });
    return;
  }

  try {
    // Convert the plain objects to the expected types
    const beforeFootprint = before.footprint ?? { readOnly: [], readWrite: [] };
    const afterFootprint = after.footprint ?? { readOnly: [], readWrite: [] };

    // Ensure the footprint entries are properly typed
    const typedBefore = {
      footprint: {
        readOnly: beforeFootprint.readOnly as any[],
        readWrite: beforeFootprint.readWrite as any[]
      }
    };

    const typedAfter = {
      footprint: {
        readOnly: afterFootprint.readOnly as any[],
        readWrite: afterFootprint.readWrite as any[]
      }
    };

    const result = footprintDiff(typedBefore, typedAfter);
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
<<<<<<< ours
>>>>>>> theirs
=======
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
>>>>>>> theirs
=======
>>>>>>> theirs
}
