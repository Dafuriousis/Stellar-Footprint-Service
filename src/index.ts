import express from "express";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import routes from "./api/routes";
import { metricsMiddleware, metrics } from "./middleware/metrics";
import { timeoutMiddleware } from "./middleware/timeout";
import { ipFilterMiddleware } from "./middleware/ipFilter";
import { requestLogger } from "./middleware/requestLogger";
import { rpcCircuitBreaker } from "./utils/circuitBreaker";

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
app.use(ipFilterMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(timeoutMiddleware);

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
  } catch (error) {
    res.status(500).end(error);
  }
});

// API v1 routes
app.use("/api/v1", routes);

// Backward-compat: redirect /api/* → /api/v1/*
app.use("/api/*", (req, res, next) => {
  const path = req.params[0];

  if (path === "v1" || path.startsWith("v1/")) {
    next();
    return;
  }

  res.redirect(
    308,
    `/api/v1/${path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`,
  );
});

app.listen(PORT, () => {
  console.warn(`stellar-footprint-service running on port ${PORT}`);
});

export default app;
