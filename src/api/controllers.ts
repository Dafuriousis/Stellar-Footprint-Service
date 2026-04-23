import { Request, Response } from "express";
import { simulateTransaction } from "../services/simulator";
import { Network } from "../config/stellar";
import metrics from "../middleware/metrics";
import { validateXdr, type XdrInputType } from "../services/validator";

export async function simulate(req: Request, res: Response): Promise<void> {
  const { xdr, network } = req.body as { xdr?: string; network?: Network };

  if (!xdr) {
    res.status(400).json({ error: "Missing required field: xdr" });
    return;
  }

  // Validate network parameter
  if (network && network !== "mainnet" && network !== "testnet") {
    res.status(400).json({ error: "Invalid network. Use 'testnet' or 'mainnet'" });
    return;
  }

  const net: Network = network === "mainnet" ? "mainnet" : "testnet";

  // Track active simulations
  metrics.incrementActiveSimulations();

  try {
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal);
    
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
}

export function validate(req: Request, res: Response): void {
  const { xdr, type } = req.body as { xdr?: string; type?: string };

  if (!xdr) {
    res.status(400).json({ error: "Missing required field: xdr" });
    return;
  }

  if (type && type !== "transaction" && type !== "operation") {
    res.status(400).json({ error: "Invalid type. Use 'transaction' or 'operation'" });
    return;
  }

  const result = validateXdr(xdr, (type as XdrInputType) ?? "transaction");
  res.status(result.valid ? 200 : 400).json(result);
}
