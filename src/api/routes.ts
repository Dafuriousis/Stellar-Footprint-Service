import { Router } from "express";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import {
<<<<<<< ours
  health,
=======
>>>>>>> theirs
=======
import {
>>>>>>> theirs
  simulate,
  footprintDiffController,
  validate,
  networkStatus,
<<<<<<< ours
<<<<<<< ours
  restore,
=======
  invalidateCache,
>>>>>>> theirs
} from "./controllers";
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import {
  health,
  simulate,
  simulateBatch,
  footprintDiffController,
  validate,
  networkStatus,
<<<<<<< ours
<<<<<<< ours
  decode,
<<<<<<< ours
  estimateFeeController,
} from "./controllers";
import { simulateRateLimiter } from "../middleware/rateLimiter";
>>>>>>> theirs
=======
} from "./controllers";
import { simulateRateLimiter } from "../middleware/rateLimiter";
>>>>>>> theirs
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import {
  simulate,
  footprintDiffController,
  validate,
  restore,
} from "./controllers";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
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
=======
} from "./controllers";

const router = Router();

// GET /health — liveness check for load balancers and uptime monitors
router.get("/health", health);

>>>>>>> theirs
// POST /simulate — accepts { xdr, network } and returns footprint + cost
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
router.post("/simulate", simulate);
=======
=======
>>>>>>> theirs
=======
} from "./controllers";
import { simulateRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// GET /health — liveness check for load balancers and uptime monitors
router.get("/health", health);

// POST /simulate — accepts { xdr, network } and returns footprint + cost
>>>>>>> theirs
router.post("/simulate", simulateRateLimiter, simulate);

// POST /simulate/batch — accepts { transactions: [{ xdr }], network } and returns array of results
router.post("/simulate/batch", simulateBatch);
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs

/**
 * @route GET /api/v1/network/status
 * @desc Returns current network information including latest ledger and RPC latency
 */
=======
import { simulate, simulateAsync, footprintDiffController, validate, networkStatus } from "./controllers";

const router = Router();

=======
  invalidateCache,
} from "./controllers";

const router = Router();

>>>>>>> theirs
// POST /simulate — accepts { xdr, network } and returns footprint + cost
router.post("/simulate", simulate);

// POST /simulate/async — accepts { xdr, network, webhookUrl }, returns 202 with jobId
router.post("/simulate/async", simulateAsync);
=======
>>>>>>> theirs

// POST /simulate/batch — accepts { transactions: [{ xdr }], network } and returns array of results
router.post("/simulate/batch", simulateBatch);
=======
>>>>>>> theirs

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
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
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

=======
// GET /decode — accepts ?xdr=&type= and returns human-readable JSON of the XDR
router.get("/decode", decode);

>>>>>>> theirs
=======
// POST /restore — accepts { xdr, network } and returns restoreXdr when restoration is needed
router.post("/restore", restore);

>>>>>>> theirs
=======
// DELETE /cache — flush all cache entries (Redis or in-memory)
router.delete("/cache", invalidateCache);

>>>>>>> theirs
=======
// POST /restore — accepts { xdr, network } and returns restoreXdr when restoration is needed
router.post("/restore", restore);

>>>>>>> theirs
=======
// POST /restore — accepts { xdr, network } and returns restoreXdr when restoration is needed
router.post("/restore", restore);

>>>>>>> theirs
=======
// POST /restore — accepts { xdr, network } and returns restoreXdr when restoration is needed
router.post("/restore", restore);

>>>>>>> theirs
=======
// POST /restore — accepts { xdr, network } and returns restoreXdr when restoration is needed
router.post("/restore", restore);

>>>>>>> theirs
export default router;
