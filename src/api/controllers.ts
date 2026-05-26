import { Request, Response } from "express";
import { simulateTransaction } from "../services/simulator";
import { Network } from "../config/stellar";
import metrics from "../middleware/metrics";
import { idempotencyCache } from "../services/cache";
import { footprintDiff } from "../services/footprintDiff";
import { validateXdr, type XdrInputType } from "../services/validator";

export async function simulate(req: Request, res: Response): Promise<void> {
  const { xdr, network } = req.body as { xdr?: string; network?: Network };

  if (!xdr) {
    res.status(400).json({ error: "Missing required field: xdr" });
    return;
  }

  // Validate network parameter
  if (network && network !== "mainnet" && network !== "testnet") {
    res
      .status(400)
      .json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
    return;
  }

  const net: Network = network === "mainnet" ? "mainnet" : "testnet";

  // Idempotency key support (#420)
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
  if (idempotencyKey) {
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached) {
      metrics.recordCacheHit("idempotency");
      res.setHeader("X-Idempotent-Replayed", "true");
      res.status(200).json(JSON.parse(cached));
      return;
    }
    metrics.recordCacheMiss("idempotency");
  }

  // Track active simulations
  metrics.incrementActiveSimulations();

  try {
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal);

    // Record simulation metrics
    metrics.recordSimulation(net, result.success);

    if (result.success && result.footprint) {
      metrics.recordFootprintEntries(
        result.footprint.readOnly.length,
        result.footprint.readWrite.length,
      );
    }

    // Store in idempotency cache (only on success)
    if (idempotencyKey && result.success) {
      idempotencyCache.set(idempotencyKey, JSON.stringify(result));
    }

    res.status(result.success ? 200 : 422).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";

    // Record failed simulation
    metrics.recordSimulation(net, false);

    res.status(500).json({ error: message });
  } finally {
    // Decrement active simulations
    metrics.decrementActiveSimulations();
  }
}

export function footprintDiffController(
  req: Request,
  res: Response,
): void {
  const { before, after } = req.body as {
    before?: { footprint?: { readOnly: never[]; readWrite: never[] } };
    after?: { footprint?: { readOnly: never[]; readWrite: never[] } };
  };

  if (!before || !after) {
    res.status(400).json({ error: "Missing required fields: before, after" });
    return;
  }

  const result = footprintDiff(before, after);
  res.status(200).json(result);
}

export function validate(req: Request, res: Response): void {
  const { xdr, type } = req.body as { xdr?: string; type?: XdrInputType };

  if (!xdr) {
    res.status(400).json({ error: "Missing required field: xdr" });
    return;
  }

  const result = validateXdr(xdr, type);
  res.status(result.valid ? 200 : 422).json(result);
}

export function cacheStats(_req: Request, res: Response): void {
  res.status(200).json(idempotencyCache.stats());
}
