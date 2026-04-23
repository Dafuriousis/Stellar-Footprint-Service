import { Router } from "express";
import { createSimulateController } from "./controllers";
import { simulateTransaction } from "../services/simulator";

const router = Router();

// Create the simulate controller with the real simulator injected
const simulate = createSimulateController(simulateTransaction);

// POST /simulate — accepts { xdr, network } and returns footprint + cost
router.post("/simulate", simulate);

export default router;
