// dotenv must be configured before any other imports that read process.env
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import routes from "./api/routes";
import { metricsMiddleware, metrics } from "./middleware/metrics";
import { timeoutMiddleware } from "./middleware/timeout";
import { ipFilterMiddleware } from "./middleware/ipFilter";
import { requestLogger } from "./middleware/requestLogger";
import { bruteForceMiddleware } from "./middleware/bruteForce";
import { contentTypeMiddleware } from "./middleware/contentType";
import { errorHandler } from "./middleware/errorHandler";
import { responseTimeMiddleware } from "./middleware/responseTime";
import { rpcCircuitBreaker } from "./utils/circuitBreaker";
import { logger } from "./utils/logger";

const app = express();
const PORT = process.env.PORT || 3000;
const COMPRESSION_THRESHOLD = parseInt(
  process.env.COMPRESSION_THRESHOLD || "1024",
  10,
);

// CORS — read allowed origins from CORS_ORIGIN env var (comma-separated list)
// Defaults to * in development, strict in production
function buildCorsOptions(): cors.CorsOptions {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) {
    return process.env.NODE_ENV === "production"
      ? { origin: false }
      : { origin: "*" };
  }
  const allowed = origin.split(",").map((o) => o.trim());
  return { origin: allowed.length === 1 ? allowed[0] : allowed };
}

app.use(cors(buildCorsOptions()));

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
app.use(contentTypeMiddleware);

// Health check endpoint
app.get("/health", (_req, res) => {
  const circuit = rpcCircuitBreaker.getState();
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    circuitBreaker: circuit,
  });
});

// Metrics endpoint
app.get("/metrics", async (_req, res) => {
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
  app.listen(PORT, () => {
    logger.info("stellar-footprint-service started", {
      port: PORT,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
    });
  });
}

export default app;
