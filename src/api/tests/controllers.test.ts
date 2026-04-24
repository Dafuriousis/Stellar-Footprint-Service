/* eslint-disable import-x/order */
import request from "supertest";

import app from "../../index";

// Mock the simulator service before any imports resolve it
jest.mock("@services/simulator");

// Mock metrics to avoid prom-client side effects in tests
jest.mock("@middleware/metrics", () => ({
  __esModule: true,
  metricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  metrics: {
    incrementActiveSimulations: jest.fn(),
    decrementActiveSimulations: jest.fn(),
    recordSimulation: jest.fn(),
    recordSimulationDuration: jest.fn(),
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    recordRpcError: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue(""),
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
    getMetrics: jest.fn().mockResolvedValue(""),
    getRegister: jest.fn(),
  },
}));

import { simulateTransaction } from "@services/simulator";

const mockSimulateTransaction = simulateTransaction as jest.MockedFunction<
  typeof simulateTransaction
>;

const VALID_XDR =
  "AAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZwAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAABAAAAAQAAAAAAAAAAAAAAAfK5hNUAAABAIbPVF4x6vSLx/J3T0SDhvTNtytA/BNO+qMJ74p/b3Y8xpBhR7xzy68FuEyffaF9fNXHEC+77WK+oOJpfon1tCg==";

describe("POST /api/v1/simulate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when xdr is missing", async () => {
    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ network: "testnet" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Missing required field: xdr" });
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when xdr is an empty string", async () => {
    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: "", network: "testnet" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Missing required field: xdr" });
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when network is invalid", async () => {
    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR, network: "invalidnet" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "Invalid network. Use 'testnet', 'mainnet', or 'futurenet'",
    });
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
  });

  it("returns 200 with result on successful simulation", async () => {
    const mockResult = {
      success: true,
      footprint: { readOnly: [], readWrite: [] },
      contracts: ["CAABC123"],
      contractType: "unknown" as const,
      ttl: {},
      optimized: false,
      rawFootprint: { readOnly: [], readWrite: [] },
      cost: { cpuInsns: "1000", memBytes: "512" },
    };
    mockSimulateTransaction.mockResolvedValueOnce(mockResult);

    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(mockSimulateTransaction).toHaveBeenCalledWith(
      VALID_XDR,
      "testnet",
      expect.anything(),
    );
  });

  it("returns 200 and defaults to testnet when network is omitted", async () => {
    const mockResult = {
      success: true,
      footprint: { readOnly: [], readWrite: [] },
      contracts: [],
      contractType: "unknown" as const,
      ttl: {},
      optimized: false,
      rawFootprint: { readOnly: [], readWrite: [] },
      cost: { cpuInsns: "0", memBytes: "0" },
    };
    mockSimulateTransaction.mockResolvedValueOnce(mockResult);

    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR });

    expect(res.status).toBe(200);
    expect(mockSimulateTransaction).toHaveBeenCalledWith(
      VALID_XDR,
      "testnet",
      expect.anything(),
    );
  });

  it("returns 200 when network is mainnet", async () => {
    const mockResult = {
      success: true,
      footprint: { readOnly: [], readWrite: [] },
      contracts: [],
      contractType: "unknown" as const,
      ttl: {},
      optimized: false,
      rawFootprint: { readOnly: [], readWrite: [] },
      cost: { cpuInsns: "0", memBytes: "0" },
    };
    mockSimulateTransaction.mockResolvedValueOnce(mockResult);

    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR, network: "mainnet" });

    expect(res.status).toBe(200);
    expect(mockSimulateTransaction).toHaveBeenCalledWith(
      VALID_XDR,
      "mainnet",
      expect.anything(),
    );
  });

  it("returns 422 when simulation fails (success: false)", async () => {
    const mockResult = {
      success: false,
      error: "Transaction simulation failed: insufficient balance",
    };
    mockSimulateTransaction.mockResolvedValueOnce(mockResult);

    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR, network: "testnet" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      error: "Transaction simulation failed: insufficient balance",
    });
  });

  it("returns 500 when simulateTransaction throws an Error", async () => {
    mockSimulateTransaction.mockRejectedValueOnce(
      new Error("RPC connection refused"),
    );

    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR, network: "testnet" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "RPC connection refused" });
  });

  it("returns 500 with generic message when a non-Error is thrown", async () => {
    mockSimulateTransaction.mockRejectedValueOnce("something went wrong");

    const res = await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR, network: "testnet" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Unexpected error" });
  });
});
