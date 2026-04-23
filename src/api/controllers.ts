import { Request, Response } from "express";
import { simulateTransaction } from "../services/simulator";
import { Network } from "../config/stellar";
import { footprintDiff } from "../services/footprintDiff";
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
  const start = Date.now();

  try {
    const result = await simulateTransaction(xdr, net, res.locals.abortSignal);
    
    const duration = (Date.now() - start) / 1000;
    
    // Record simulation metrics
    metrics.recordSimulation(net, result.success);
    metrics.recordSimulationDuration(net, duration);
    
    res.status(result.success ? 200 : 422).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    
    // Record failed simulation
    metrics.recordSimulation(net, false);
    
    // Record RPC error if applicable
    if (message.toLowerCase().includes('rpc') || message.toLowerCase().includes('connection')) {
        metrics.recordRpcError(net, 'connection_failure');
    }
    
    res.status(500).json({ error: message });
  } finally {
    // Decrement active simulations
    metrics.decrementActiveSimulations();
  }
}

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
}
