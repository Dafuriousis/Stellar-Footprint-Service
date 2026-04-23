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

<<<<<<< ours
// Simulation metrics from PR 159
const simulateRequestsTotal = new client.Counter({
  name: "simulate_requests_total",
  help: "Total number of Stellar simulations",
  labelNames: ["network", "status"],
=======
// Required simulation metrics
const simulateRequestsTotal = new client.Counter({
  name: 'simulate_requests_total',
  help: 'Total number of Stellar simulations',
  labelNames: ['network', 'status'],
>>>>>>> theirs
  registers: [register],
});

const simulateDurationSeconds = new client.Histogram({
<<<<<<< ours
  name: "simulate_duration_seconds",
  help: "Duration of Stellar simulations in seconds",
  labelNames: ["network"],
=======
  name: 'simulate_duration_seconds',
  help: 'Duration of Stellar simulations in seconds',
  labelNames: ['network'],
>>>>>>> theirs
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

<<<<<<< ours
// RPC health metrics from PR 159
const rpcErrorsTotal = new client.Counter({
  name: "rpc_errors_total",
  help: "Total number of RPC errors",
  labelNames: ["network", "error_type"],
  registers: [register],
});

=======
>>>>>>> theirs
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

<<<<<<< ours
// Stellar-specific simulations Total (from HEAD/main)
const stellarSimulationsTotal = new client.Counter({
  name: "stellar_simulations_total",
  help: "Total number of Stellar simulations",
  labelNames: ["network", "success"],
<<<<<<< ours
=======
// RPC health metrics
const rpcErrorsTotal = new client.Counter({
  name: 'rpc_errors_total',
  help: 'Total number of RPC errors',
  labelNames: ['network', 'error_type'],
>>>>>>> theirs
=======
>>>>>>> theirs
  registers: [register],
});

// Tracking active simulations
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
<<<<<<< ours
<<<<<<< ours
=======
>>>>>>> theirs

  // Stellar simulation metrics
=======
  
  // REQUIRED: Stellar simulation metrics
>>>>>>> theirs
  recordSimulation: (network: string, success: boolean) => {
    simulateRequestsTotal.inc({
      network,
<<<<<<< ours
      success: success ? "true" : "false",
    });
    // Also record in the PR 159 counter for backwards compatibility/consistency
    simulateRequestsTotal.inc({
      network,
      status: success ? "success" : "failure",
=======
      status: success ? 'success' : 'failure',
>>>>>>> theirs
    });
  },

  recordSimulationDuration: (network: string, durationInSeconds: number) => {
    simulateDurationSeconds.observe({ network }, durationInSeconds);
  },

<<<<<<< ours
  // RPC metrics
  recordRpcError: (network: string, errorType: string) => {
    rpcErrorsTotal.inc({ network, error_type: errorType });
  },

=======
  // REQUIRED: RPC metrics
  recordRpcError: (network: string, errorType: string) => {
    rpcErrorsTotal.inc({ network, error_type: errorType });
  },
<<<<<<< ours
  
>>>>>>> theirs
=======

>>>>>>> theirs
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
<<<<<<< ours
<<<<<<< ours
=======
>>>>>>> theirs

  // Get register for custom metrics
  getRegister: () => register,
=======
>>>>>>> theirs
};

export default metrics;
