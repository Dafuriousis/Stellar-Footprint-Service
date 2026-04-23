import express from "express";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import routes from "@api/routes";
import { metricsMiddleware, metrics } from "@middleware/metrics";
import { timeoutMiddleware } from "@middleware/timeout";
import { ipFilterMiddleware } from "@middleware/ipFilter";
import { requestLogger } from "@middleware/requestLogger";
import { bruteForceMiddleware } from "@middleware/bruteForce";
import { errorHandler } from "@middleware/errorHandler";
import routes from "./api/routes";
import { metricsMiddleware, metrics } from "./middleware/metrics";
import { timeoutMiddleware } from "./middleware/timeout";
<<<<<<< ours
import { ipFilterMiddleware } from "./middleware/ipFilter";
import { requestLogger } from "./middleware/requestLogger";
import { bruteForceMiddleware } from "./middleware/bruteForce";
<<<<<<< ours
<<<<<<< ours
import { contentTypeMiddleware } from "./middleware/contentType";
import { errorHandler } from "./middleware/errorHandler";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { rpcCircuitBreaker } from "./utils/circuitBreaker";
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import { logger } from "./utils/logger";
=======
import { responseTimeMiddleware } from "./middleware/responseTime";
>>>>>>> theirs
=======
import { responseTimeMiddleware } from "./middleware/responseTime";
>>>>>>> theirs
=======
import { bruteForceMiddleware } from "./middleware/bruteForce";
>>>>>>> theirs

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const COMPRESSION_THRESHOLD = parseInt(
  process.env.COMPRESSION_THRESHOLD || "1024",
  10,
);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use(compression({ threshold: COMPRESSION_THRESHOLD }));
app.use(express.json());
app.use(responseTimeMiddleware);
app.use(ipFilterMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(timeoutMiddleware);
app.use(bruteForceMiddleware);
<<<<<<< ours
app.use(contentTypeMiddleware);
=======
>>>>>>> theirs

// Health check endpoint
<<<<<<< ours
app.get("/health", (req, res) => {
<<<<<<< ours
  const circuit = rpcCircuitBreaker.getState();
  res.status(200).json({
    status: "healthy",
=======
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
>>>>>>> theirs
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    circuitBreaker: circuit,
=======
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
>>>>>>> theirs
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

// API v1 routes
app.use("/api/v1", routes);
<<<<<<< ours
=======

// Backward-compat: redirect /api/* → /api/v1/*
app.use("/api/:path(*)", (req, res) => {
  res.redirect(308, `/api/v1/${req.params.path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`);
});
>>>>>>> theirs

<<<<<<< ours
// Backward-compat: redirect /api/* → /api/v1/*
app.use("/api/:path(*)", (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (req.params as any)["path"] || "";
  res.redirect(
    308,
    `/api/v1/${path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`,
  );
});
=======
// Only start the server when this file is run directly (not imported in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.warn(`stellar-footprint-service running on port ${PORT}`);
  });
}
>>>>>>> theirs

// Error handling middleware (must be last)
app.use(errorHandler);

<<<<<<< ours
// Only start the server when this file is run directly (not imported in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info("stellar-footprint-service started", {
      port: PORT,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
    });
  });
}
=======
app.listen(PORT, () => {
  logger.info("stellar-footprint-service started", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
  });
});
>>>>>>> theirs

export default app;
