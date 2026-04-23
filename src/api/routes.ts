import { Router } from "express";
import {
  health,
  simulate,
  simulateBatch,
  footprintDiffController,
  validate,
  networkStatus,
  decode,
} from "./controllers";
import { simulateRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Create the simulate controller with the real simulator injected
const simulate = createSimulateController(simulateTransaction);

// POST /simulate — accepts { xdr, network } and returns footprint + cost
router.post("/simulate", simulateRateLimiter, simulate);

// POST /simulate/batch — accepts { transactions: [{ xdr }], network } and returns array of results
router.post("/simulate/batch", simulateBatch);

// GET /network/status — returns current network information
router.get("/network/status", networkStatus);

// POST /footprint/diff — accepts { before, after } and returns added/removed ledger keys
router.post("/footprint/diff", footprintDiffController);

// POST /validate — accepts { xdr, type } and returns parse result without simulating
router.post("/validate", validate);

// GET /decode — accepts ?xdr=&type= and returns human-readable JSON of the XDR
router.get("/decode", decode);

export default router;
