import { Router } from "express";
import {
  simulate,
  footprintDiffController,
  validate,
  networkStatus,
  invalidateCache,
} from "./controllers";

const router = Router();

// POST /simulate — accepts { xdr, network } and returns footprint + cost
router.post("/simulate", simulate);

// GET /network/status — returns current network information
router.get("/network/status", networkStatus);

// POST /footprint/diff — accepts { before, after } and returns added/removed ledger keys
router.post("/footprint/diff", footprintDiffController);

// POST /validate — accepts { xdr, type } and returns parse result without simulating
router.post("/validate", validate);

// DELETE /cache — flush all cache entries (Redis or in-memory)
router.delete("/cache", invalidateCache);

export default router;
