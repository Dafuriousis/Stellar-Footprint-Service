import { Router } from "express";
import { simulate, validate } from "./controllers";

const router = Router();

// POST /simulate — accepts { xdr, network } and returns footprint + cost
router.post("/simulate", simulate);

// POST /validate — accepts { xdr, type } and returns parse result without simulating
router.post("/validate", validate);

export default router;
