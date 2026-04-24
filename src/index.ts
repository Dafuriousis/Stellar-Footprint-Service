// dotenv must be configured before any other imports that read process.env
// eslint-disable-next-line import-x/order
import dotenv from "dotenv";
dotenv.config();

import path from "path";

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
import { responseTimeMiddleware } from "./middleware/responseTime";
import { timeoutMiddleware } from "./middleware/timeout";
import { logger } from "./utils/logger";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const COMPRESSION_THRESHOLD = parseInt(
  process.env.COMPRESSION_THRESHOLD || "1024",
  10,
);

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
  if (fs.existsSync(specPath)) {
    const spec = YAML.parse(fs.readFileSync(specPath, "utf8")) as Record<
      string,
      unknown
    >;
    const swaggerSetup = swaggerUi.setup(spec, {
      customSiteTitle: "Stellar Footprint Service API",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).use("/api/docs", swaggerUi.serve, swaggerSetup);
  }
}

app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", "text/plain");
    res.end(await metrics.getMetrics());
  } catch (error: unknown) {
    res.status(500).end(error instanceof Error ? error.message : String(error));
  }
});

app.use("/api/v1", routes);

app.use("/api/*path", (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _p = ((req.params as any)["0"] ?? (req.params as any)["path"]) || "";
  res.redirect(
    308,
    `/api/v1/${_p}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`,
  );
});

app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
      },
      "stellar-footprint-service started",
    );
  });

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
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection");
  });
}

export default app;
