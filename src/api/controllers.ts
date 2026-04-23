import { Request, Response } from "express";
import { simulateTransaction } from "../services/simulator";
import { Network } from "../config/stellar";
import metrics from "../middleware/metrics";

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
    
    const { raw, ...clientResult } = result;
    res.status(result.success ? 200 : 422).json(clientResult);
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
