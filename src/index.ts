import express from "express";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import routes from "./api/routes";
import { metricsMiddleware, metrics } from "./middleware/metrics";
import { timeoutMiddleware } from "./middleware/timeout";
import { ipFilterMiddleware } from "./middleware/ipFilter";
import { requestLogger } from "./middleware/requestLogger";
import { bruteForceMiddleware } from "./middleware/bruteForce";
import { contentTypeMiddleware } from "./middleware/contentType";
import { errorHandler } from "./middleware/errorHandler";
import { rpcCircuitBreaker } from "./utils/circuitBreaker";
import { logger } from "./utils/logger";

dotenv.config();

const app = express();
const _rawPort = process.env.PORT || "3000";
const _parsedPort = parseInt(_rawPort, 10);
if (!Number.isInteger(_parsedPort) || _parsedPort <= 0 || String(_parsedPort) !== _rawPort.trim()) {
  throw new Error(`PORT must be a valid number, got: "${_rawPort}"`);
}
const PORT = _parsedPort;
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
app.use(express.json({ limit: process.env.BODY_LIMIT || "100kb" }));
app.use(responseTimeMiddleware);
app.use(ipFilterMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(timeoutMiddleware);
app.use(bruteForceMiddleware);
app.use(contentTypeMiddleware);

// Health check endpoint
app.get("/health", (req, res) => {
  const circuit = rpcCircuitBreaker.getState();
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    circuitBreaker: circuit,
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

// Backward-compat: redirect /api/* → /api/v1/*
app.use("/api/:path(*)", (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (req.params as any)["path"] || "";
  res.redirect(
    308,
    `/api/v1/${path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`,
  );
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Only start the server when this file is run directly (not imported in tests)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info("stellar-footprint-service started", {
      port: PORT,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Graceful shutdown: stop accepting new connections and wait for in-flight
  // requests to finish before exiting. A forced exit fires after 10 seconds.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      logger.info("Server closed, exiting");
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn("Forced exit after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Safety net for any unhandled promise rejections
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason });
  });
}

export default app;
