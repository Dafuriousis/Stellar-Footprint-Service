/**
 * #339 — Verify gzip compression is applied to the /metrics endpoint
 *
 * The compression middleware is registered globally in index.ts before the
 * /metrics route, so any response body that exceeds COMPRESSION_THRESHOLD
 * bytes should be gzip-encoded when the client sends Accept-Encoding: gzip.
 */

const THRESHOLD = 128;
process.env.COMPRESSION_THRESHOLD = String(THRESHOLD);

// Minimal metrics mock — make getMetrics return a payload larger than threshold
jest.mock("@middleware/metrics", () => {
  const largePayload = "# HELP metric info\n".repeat(20); // well above 128 bytes
  return {
    __esModule: true,
    metricsMiddleware: (_req: unknown, _res: unknown, next: () => void) =>
      next(),
    metrics: {
      incrementActiveSimulations: jest.fn(),
      decrementActiveSimulations: jest.fn(),
      recordSimulation: jest.fn(),
      recordSimulationDuration: jest.fn(),
      recordCacheHit: jest.fn(),
      recordCacheMiss: jest.fn(),
      recordRpcError: jest.fn(),
      recordXdrBytes: jest.fn(),
      getMetrics: jest.fn().mockResolvedValue(largePayload),
      getRegister: jest.fn(),
    },
    default: {
      incrementActiveSimulations: jest.fn(),
      decrementActiveSimulations: jest.fn(),
      recordSimulation: jest.fn(),
      recordSimulationDuration: jest.fn(),
      recordCacheHit: jest.fn(),
      recordCacheMiss: jest.fn(),
      recordRpcError: jest.fn(),
      recordXdrBytes: jest.fn(),
      getMetrics: jest.fn().mockResolvedValue(largePayload),
      getRegister: jest.fn(),
    },
  };
});

import request from "supertest";

import app from "../index";

describe("/metrics compression (#339)", () => {
  it("compresses /metrics response when payload exceeds threshold and client accepts gzip", async () => {
    const res = await request(app)
      .get("/metrics")
      .set("Accept-Encoding", "gzip");

    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
  });

  it("does not compress /metrics when client does not accept gzip", async () => {
    const res = await request(app)
      .get("/metrics")
      .set("Accept-Encoding", "identity");

    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"] ?? "").not.toBe("gzip");
  });
});
