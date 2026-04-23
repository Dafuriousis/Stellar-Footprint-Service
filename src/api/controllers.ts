import { Request, Response } from "express";
import { simulateTransaction } from "../services/simulator";
import { Network } from "../config/stellar";
import metrics from "../middleware/metrics";
import * as StellarSdk from "@stellar/stellar-sdk";

export async function simulate(req: Request, res: Response): Promise<void> {
  const { xdr, network, dryRun } = req.body as {
    xdr?: string;
    network?: Network;
    dryRun?: boolean;
  };

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
