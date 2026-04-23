import { Request, Response } from "express";
import { Network } from "../config/stellar";
import metrics from "../middleware/metrics";
import type { SimulateResult } from "../services/simulator";

export type SimulatorFunction = (
  xdr: string,
  network: Network,
  signal?: AbortSignal,
  ledgerSequence?: number,
) => Promise<SimulateResult>;

export function createSimulateController(simulator: SimulatorFunction) {
  return async (req: Request, res: Response): Promise<void> => {
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

    // Track active simulations
    metrics.incrementActiveSimulations();

    try {
      const result = await simulator(xdr, net, res.locals.abortSignal);

      // Record simulation metrics
      metrics.recordSimulation(net, result.success);

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
  };
}

export async function footprintDiffController(
  req: Request,
  res: Response,
): Promise<void> {
  const { before, after } = req.body as {
    before?: string[];
    after?: string[];
  };

  if (!before || !after) {
    res.status(400).json({ error: "Missing required fields: before, after" });
    return;
  }

  try {
    const added = after.filter((item) => !before.includes(item));
    const removed = before.filter((item) => !after.includes(item));

    res.status(200).json({ added, removed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
}

export async function validate(req: Request, res: Response): Promise<void> {
  const { xdr, type } = req.body as { xdr?: string; type?: string };

  if (!xdr) {
    res.status(400).json({ error: "Missing required field: xdr" });
    return;
  }

  try {
    const isValid = typeof xdr === "string" && xdr.length > 0;

    res.status(200).json({ valid: isValid, type: type || "unknown" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  }
}
