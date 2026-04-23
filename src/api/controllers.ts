import { Request, Response, NextFunction } from "express";
import { simulateTransaction } from "../services/simulator";
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
    return next(new AppError(ERROR_MESSAGES.MISSING_XDR, HTTP_STATUS.BAD_REQUEST));
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

  metrics.incrementActiveSimulations();

  try {
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal);
    metrics.recordSimulation(net, result.success);
    res.status(result.success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);
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
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
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
  try {
    res.status(HTTP_STATUS.OK).json({ message: "Not implemented" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
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
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}
