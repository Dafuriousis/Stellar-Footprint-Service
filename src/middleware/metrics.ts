import client from "prom-client";
import { Request, Response, NextFunction } from "express";

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: "stellar_footprint_service_",
});

// HTTP request metrics
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Cache metrics
const cacheHitsTotal = new client.Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache_type"],
  registers: [register],
});

const cacheMissesTotal = new client.Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache_type"],
  registers: [register],
});

// Stellar-specific metrics
const stellarSimulationsTotal = new client.Counter({
  name: "stellar_simulations_total",
  help: "Total number of Stellar simulations",
  labelNames: ["network", "success"],
  registers: [register],
});

const activeSimulations = new client.Gauge({
  name: "active_simulations",
  help: "Number of currently active simulations",
  registers: [register],
});

// Middleware to track HTTP metrics
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
      },
      duration,
    );
  });

  next();
}

// Metrics tracking functions
export const metrics = {
  // Cache metrics
  recordCacheHit: (cacheType: string = "simulation") => {
    cacheHitsTotal.inc({ cache_type: cacheType });
  },

  recordCacheMiss: (cacheType: string = "simulation") => {
    cacheMissesTotal.inc({ cache_type: cacheType });
  },

  // Stellar simulation metrics
  recordSimulation: (network: string, success: boolean) => {
    stellarSimulationsTotal.inc({
      network,
      success: success.toString(),
    });
  },

  // Active simulations
  incrementActiveSimulations: () => {
    activeSimulations.inc();
  },

  decrementActiveSimulations: () => {
    activeSimulations.dec();
  },

  // Get current metrics
  getMetrics: async (): Promise<string> => {
    return await register.metrics();
  },

  // Get register for custom metrics
  getRegister: () => register,
};

export default metrics;
