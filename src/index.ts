// dotenv must be configured before any other imports that read process.env
// eslint-disable-next-line import-x/order
import dotenv from "dotenv";
dotenv.config();

import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import routes from "./api/routes";
import { bruteForceMiddleware } from "./middleware/bruteForce";
import { contentTypeMiddleware } from "./middleware/contentType";
import { errorHandler } from "./middleware/errorHandler";
import { ipFilterMiddleware } from "./middleware/ipFilter";
import { metricsMiddleware, metrics } from "./middleware/metrics";
import { requestIdMiddleware } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { timeoutMiddleware } from "./middleware/timeout";
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
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(timeoutMiddleware);
app.use(bruteForceMiddleware);
app.use(contentTypeMiddleware);

// Swagger UI — development only
if (process.env.NODE_ENV !== "production") {
  const swaggerUi =
    require("swagger-ui-express") as typeof import("swagger-ui-express");

  const YAML = require("yaml") as { parse: (s: string) => unknown };
  const fs = require("fs") as typeof import("fs");
  const specPath = path.join(__dirname, "..", "openapi.yaml");
  const spec = YAML.parse(fs.readFileSync(specPath, "utf8"));
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "Stellar Footprint Service API",
    }),
  );
}

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
  const _p = ((req.params as any)["0"] ?? (req.params as any)["path"]) || "";
  res.redirect(
    308,
    `/api/v1/${_p}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`,
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
