import { Request, Response, NextFunction } from "express";
import { simulateTransaction } from "../services/simulator";
import { Network } from "../config/stellar";
import { getNetworkStatus } from "../services/networkStatus";
import { estimateFee } from "../services/feeEstimator";
import metrics from "../middleware/metrics";
import { AppError } from "../utils/AppError";
import { decodeXdr, type XdrType } from "../services/decoder";
import {
  NETWORKS,
  DEFAULT_NETWORK,
  ERROR_MESSAGES,
  HTTP_STATUS,
  BATCH_MAX_SIZE,
} from "../constants";
import { version } from "../../package.json";

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

  try {
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal);
    metrics.recordSimulation(net, result.success);
    res.setHeader("X-Cache", result.cacheHit ? "HIT" : "MISS");
    res
      .status(
        result.success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY,
      )
      .json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    metrics.recordSimulation(net, false);
    next(new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
  } finally {
    metrics.decrementActiveSimulations();
  }
}

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
    const message =
      err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
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
  try {
    res.status(HTTP_STATUS.OK).json({ message: "Not implemented" });
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
    return next(
      new AppError(
        result.error ?? "Failed to decode XDR",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }

  res.status(HTTP_STATUS.OK).json(result);
}
