import { Request, Response, NextFunction } from "express";
import { simulateTransaction } from "../services/simulator";
import { buildRestoreTransaction } from "../services/restorer";
import { Network } from "../config/stellar";
import { getNetworkStatus } from "../services/networkStatus";
import metrics from "../middleware/metrics";
import { AppError } from "../utils/AppError";
import {
  NETWORKS,
  DEFAULT_NETWORK,
  ERROR_MESSAGES,
  HTTP_STATUS,
} from "../constants";

/**
 * Handle POST /api/simulate requests
 * Simulates a Soroban transaction and returns its footprint and resource costs
 * @param req - Express request with xdr and optional network in body
 * @param res - Express response
 * @param next - Express next function for error handling
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

  if (
    network &&
    network !== NETWORKS.MAINNET &&
    network !== NETWORKS.TESTNET
  ) {
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

    // Record simulation metrics
    metrics.recordSimulation(net, result.success);
    metrics.recordSimulationDuration(net, duration);

    res
      .status(result.success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY)
      .json(result);
  } catch (err: unknown) {
    // Handle circuit breaker open state (from pr-179)
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

    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;

    // Record failed simulation
    metrics.recordSimulation(net, false);

    // Record RPC error if applicable
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

/**
 * Handle GET /api/network/status requests
 * Returns current network information including latest ledger and RPC latency
 * @param req - Express request with optional network query parameter
 * @param res - Express response
 * @param next - Express next function for error handling
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
    res.status(HTTP_STATUS.OK).json(status);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

/**
 * Handle POST /api/footprint/diff requests
 * Compares two footprints and returns differences
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function for error handling
 */
export async function footprintDiffController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { before, after } = req.body as {
    before?: {
      footprint?: {
        readOnly: any[];
        readWrite: any[];
      } | null;
    };
    after?: {
      footprint?: {
        readOnly: any[];
        readWrite: any[];
      } | null;
    };
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
    // This will be implemented fully once optimization logic is merged
    res.status(HTTP_STATUS.OK).json({ message: "Not fully implemented" });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

/**
 * Handle POST /api/validate requests
 * Validates transaction XDR without simulating
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function for error handling
 */
export async function validate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(HTTP_STATUS.OK).json({ message: "Not implemented" });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

/**
 * Handle POST /api/restore requests
 * Returns a restoration transaction if the transaction requires it
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function for error handling
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
    res.status(HTTP_STATUS.OK).json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}
