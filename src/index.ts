import express from "express";
import compression from "compression";
import dotenv from "dotenv";
import routes from "./api/routes";
import { metricsMiddleware, metrics } from "./middleware/metrics";
import { timeoutMiddleware } from "./middleware/timeout";
import { ipFilterMiddleware } from "./middleware/ipFilter";
import { requestLogger } from "./middleware/requestLogger";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const COMPRESSION_THRESHOLD = parseInt(process.env.COMPRESSION_THRESHOLD || "1024", 10);

// Middleware
app.use(compression({ threshold: COMPRESSION_THRESHOLD }));
app.use(express.json());
app.use(ipFilterMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(timeoutMiddleware);

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
  } catch (error) {
    res.status(500).end(error);
  }
});

// API routes
app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`stellar-footprint-service running on port ${PORT}`);
});

export default app;
