import { Router } from "express";
<<<<<<< ours
<<<<<<< ours
import {
<<<<<<< ours
  health,
=======
>>>>>>> theirs
  simulate,
  footprintDiffController,
  validate,
  networkStatus,
<<<<<<< ours
  restore,
=======
  invalidateCache,
>>>>>>> theirs
} from "./controllers";
=======
import {
  health,
  simulate,
  simulateBatch,
  footprintDiffController,
  validate,
  networkStatus,
  decode,
  estimateFeeController,
} from "./controllers";
import { simulateRateLimiter } from "../middleware/rateLimiter";
>>>>>>> theirs

const router = Router();

<<<<<<< ours
/**
 * @route GET /api/v1/health
 * @desc Liveness check for load balancers and uptime monitors
 */
router.get("/health", health);

/**
 * @route POST /api/v1/simulate
 * @desc Simulates a Soroban transaction and returns its footprint and cost
 */
=======
// POST /simulate — accepts { xdr, network } and returns footprint + cost
<<<<<<< ours
>>>>>>> theirs
router.post("/simulate", simulate);
=======
router.post("/simulate", simulateRateLimiter, simulate);

// POST /simulate/batch — accepts { transactions: [{ xdr }], network } and returns array of results
router.post("/simulate/batch", simulateBatch);
>>>>>>> theirs

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

<<<<<<< ours
<<<<<<< ours
/**
 * @route POST /api/v1/restore
 * @desc Returns a restoration transaction if the transaction requires it
 */
router.post("/restore", restore);
=======
// DELETE /cache — flush all cache entries (Redis or in-memory)
router.delete("/cache", invalidateCache);
>>>>>>> theirs
=======
// GET /decode — accepts ?xdr=&type= and returns human-readable JSON of the XDR
router.get("/decode", decode);

// POST /estimate-fee — accepts { cpuInsns, memBytes, network } and returns fee breakdown
router.post("/estimate-fee", estimateFeeController);
>>>>>>> theirs

export default router;
