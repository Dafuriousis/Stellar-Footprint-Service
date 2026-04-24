import express from "express";
import compression from "compression";
import dotenv from "dotenv";
import routes from "./api/routes";
import { metricsMiddleware, metrics } from "./middleware/metrics";
import { timeoutMiddleware } from "./middleware/timeout";
import { ipFilterMiddleware } from "./middleware/ipFilter";
import { requestIdMiddleware } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { bruteForceMiddleware } from "./middleware/bruteForce";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

dotenv.config();

import { env } from "./config/env";

const app = express();
const PORT = env.PORT;
const COMPRESSION_THRESHOLD = env.COMPRESSION_THRESHOLD;

// Middleware
app.use(compression({ threshold: COMPRESSION_THRESHOLD }));
app.use(express.json());
app.use(ipFilterMiddleware);
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(timeoutMiddleware);
app.use(bruteForceMiddleware);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", "text/plain");
    res.end(await metrics.getMetrics());
  } catch (error: unknown) {
    res.status(500).end(error instanceof Error ? error.message : String(error));
  }
});

// API routes
app.use("/api", routes);

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(
    { port: PORT, environment: env.NODE_ENV },
    "stellar-footprint-service started",
  );
});

export default app;
