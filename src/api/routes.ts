import { Router } from "express";
import { simulate, simulateAsync, footprintDiffController, validate, networkStatus } from "./controllers";

const router = Router();

// POST /simulate — accepts { xdr, network } and returns footprint + cost
router.post("/simulate", simulate);

// POST /simulate/async — accepts { xdr, network, webhookUrl }, returns 202 with jobId
router.post("/simulate/async", simulateAsync);

// GET /network/status — returns current network information
router.get("/network/status", networkStatus);

// POST /footprint/diff — accepts { before, after } and returns added/removed ledger keys
router.post("/footprint/diff", footprintDiffController);

// POST /validate — accepts { xdr, type } and returns parse result without simulating
router.post("/validate", validate);

export default router;
