import { Router } from "express";
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
>>>>>>> theirs
router.post("/simulate", simulate);

/**
 * @route GET /api/v1/network/status
 * @desc Returns current network information including latest ledger and RPC latency
 */
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
/**
 * @route POST /api/v1/restore
 * @desc Returns a restoration transaction if the transaction requires it
 */
router.post("/restore", restore);
=======
// DELETE /cache — flush all cache entries (Redis or in-memory)
router.delete("/cache", invalidateCache);
>>>>>>> theirs

export default router;
