import { Router } from "express";
<<<<<<< ours
import {
  health,
  simulate,
  footprintDiffController,
  validate,
  networkStatus,
  restore,
} from "./controllers";

const router = Router();

/**
 * @route GET /api/v1/health
 * @desc Liveness check for load balancers and uptime monitors
 */
router.get("/health", health);

/**
 * @route POST /api/v1/simulate
 * @desc Simulates a Soroban transaction and returns its footprint and cost
 */
router.post("/simulate", simulate);

/**
 * @route GET /api/v1/network/status
 * @desc Returns current network information including latest ledger and RPC latency
 */
=======
import { simulate, simulateAsync, footprintDiffController, validate, networkStatus } from "./controllers";

const router = Router();

// POST /simulate — accepts { xdr, network } and returns footprint + cost
router.post("/simulate", simulate);

// POST /simulate/async — accepts { xdr, network, webhookUrl }, returns 202 with jobId
router.post("/simulate/async", simulateAsync);

// GET /network/status — returns current network information
>>>>>>> theirs
router.get("/network/status", networkStatus);

/**
 * @route POST /api/v1/footprint/diff
 * @desc Compares two footprints and returns differences
 */
router.post("/footprint/diff", footprintDiffController);

/**
 * @route POST /api/v1/validate
 * @desc Validates transaction XDR without simulating
 */
router.post("/validate", validate);

/**
 * @route POST /api/v1/restore
 * @desc Returns a restoration transaction if the transaction requires it
 */
router.post("/restore", restore);

export default router;
