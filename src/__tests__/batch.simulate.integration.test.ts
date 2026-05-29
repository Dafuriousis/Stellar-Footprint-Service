import { simulateTransaction } from "@services/simulator";
import request from "supertest";

import { BATCH_MAX_SIZE } from "../constants";
import app from "../index";

jest.mock("@services/simulator", () => ({
  simulateTransaction: jest.fn(),
  simulationCache: { get: jest.fn(), set: jest.fn() },
}));

jest.mock("@middleware/metrics", () => ({
  __esModule: true,
  default: {
    incrementActiveSimulations: jest.fn(),
    decrementActiveSimulations: jest.fn(),
    recordSimulation: jest.fn(),
    recordSimulationDuration: jest.fn(),
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    recordRpcError: jest.fn(),
    recordCacheLatency: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue(""),
  },
  metricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  metrics: { getMetrics: jest.fn().mockResolvedValue("") },
}));

const mockSimulate = simulateTransaction as jest.MockedFunction<
  typeof simulateTransaction
>;

const VALID_XDR = "AAAAAgAAAAC" + "A".repeat(40) + "==";

const makeResult = (cacheHit = false) => ({
  success: true,
  footprint: { readOnly: [], readWrite: [] },
  contracts: [],
  contractType: "unknown" as const,
  ttl: {},
  optimized: false,
  rawFootprint: { readOnly: [], readWrite: [] },
  cost: { cpuInsns: "100", memBytes: "200" },
  cacheHit,
});

beforeEach(() => jest.clearAllMocks());

describe("POST /api/v1/simulate/batch — validation", () => {
  it("returns 400 when transactions array is empty", async () => {
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions: [], network: "testnet" });

    expect(res.status).toBe(400);
    expect(mockSimulate).not.toHaveBeenCalled();
  });

  it("returns 400 when transactions field is missing", async () => {
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ network: "testnet" });

    expect(res.status).toBe(400);
    expect(mockSimulate).not.toHaveBeenCalled();
  });

  it(`returns 400 when batch exceeds max size of ${BATCH_MAX_SIZE}`, async () => {
    const transactions = Array.from({ length: BATCH_MAX_SIZE + 1 }, () => ({
      xdr: VALID_XDR,
    }));

    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(400);
    expect(mockSimulate).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/simulate/batch — mixed success/failure results", () => {
  it("returns success and failure entries without aborting the batch", async () => {
    mockSimulate
      .mockResolvedValueOnce(makeResult() as never)
      .mockRejectedValueOnce(new Error("RPC timeout"))
      .mockResolvedValueOnce(makeResult() as never);

    const transactions = Array.from({ length: 3 }, () => ({ xdr: VALID_XDR }));
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results[0]).toMatchObject({ success: true });
    expect(res.body.results[1]).toMatchObject({
      success: false,
      error: "RPC timeout",
    });
    expect(res.body.results[2]).toMatchObject({ success: true });
  });
});

describe("POST /api/v1/simulate/batch — X-Cache header", () => {
  it("sets X-Cache: MISS when no results are cache hits", async () => {
    mockSimulate.mockResolvedValue(makeResult(false) as never);

    const transactions = [{ xdr: VALID_XDR }, { xdr: VALID_XDR }];
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("MISS");
  });

  it("sets X-Cache: PARTIAL when some results are cache hits", async () => {
    mockSimulate
      .mockResolvedValueOnce(makeResult(true) as never)
      .mockResolvedValueOnce(makeResult(false) as never);

    const transactions = [{ xdr: VALID_XDR }, { xdr: VALID_XDR }];
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("PARTIAL");
  });

  it("sets X-Cache: HIT when all results are cache hits", async () => {
    mockSimulate.mockResolvedValue(makeResult(true) as never);

    const transactions = [{ xdr: VALID_XDR }, { xdr: VALID_XDR }];
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("HIT");
  });
});
