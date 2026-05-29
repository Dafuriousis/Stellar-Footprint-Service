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
    recordXdrBytes: jest.fn(),
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
    recordXdrBytes: jest.fn(),
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

  it("records XDR byte length via metrics.recordXdrBytes", async () => {
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

    const { default: metrics } = jest.requireMock("@middleware/metrics");

    await request(app)
      .post("/api/v1/simulate")
      .send({ xdr: VALID_XDR, network: "testnet" });

    expect(metrics.recordXdrBytes).toHaveBeenCalledWith(
      Buffer.from(VALID_XDR, "base64").length,
    );
  });
});

describe("GET /api/v1/openapi.json", () => {
  it("returns 200 with Content-Type application/json", async () => {
    const res = await request(app).get("/api/v1/openapi.json");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("returns a parsed object with openapi or info field", async () => {
    const res = await request(app).get("/api/v1/openapi.json");

    expect(res.status).toBe(200);
    // The spec should have at least one of these top-level keys
    expect(res.body.openapi !== undefined || res.body.info !== undefined).toBe(
      true,
    );
  });
});

// ── #427: GET /simulate/supported-networks ────────────────────────────────

describe("GET /api/v1/simulate/supported-networks", () => {
  const orig = process.env;

  beforeEach(() => {
    process.env = { ...orig };
  });

  afterEach(() => {
    process.env = orig;
  });

  it("returns only networks with a configured RPC URL", async () => {
    process.env.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
    delete process.env.MAINNET_RPC_URL;
    delete process.env.FUTURENET_RPC_URL;

    const res = await request(app).get("/api/v1/simulate/supported-networks");

    expect(res.status).toBe(200);
    expect(res.body.networks).toEqual(["testnet"]);
  });

  it("returns all three networks when all RPC URLs are set", async () => {
    process.env.TESTNET_RPC_URL = "https://testnet.example.com";
    process.env.MAINNET_RPC_URL = "https://mainnet.example.com";
    process.env.FUTURENET_RPC_URL = "https://futurenet.example.com";

    const res = await request(app).get("/api/v1/simulate/supported-networks");

    expect(res.status).toBe(200);
    expect(res.body.networks).toEqual(["testnet", "mainnet", "futurenet"]);
  });

  it("returns empty array when no RPC URLs are configured", async () => {
    delete process.env.TESTNET_RPC_URL;
    delete process.env.MAINNET_RPC_URL;
    delete process.env.FUTURENET_RPC_URL;

    const res = await request(app).get("/api/v1/simulate/supported-networks");

    expect(res.status).toBe(200);
    expect(res.body.networks).toEqual([]);
  });
});

// ── #424: network label in HTTP metrics ──────────────────────────────────

describe("network label in HTTP metrics", () => {
  it("records simulation with the correct network label", async () => {
    const mockMetrics = jest.requireMock("@middleware/metrics").default;
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

await request(app)
       .post("/api/v1/simulate")
       .send({ xdr: VALID_XDR, network: "mainnet" });

    expect(mockMetrics.recordSimulation).toHaveBeenCalledWith("mainnet", true);
  });
});

// ── POST /footprint/diff ────────────────────────────────────────────────────

describe("POST /api/v1/footprint/diff", () => {
  it("returns 400 when before is missing", async () => {
    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({ after: { readOnly: [], readWrite: [] } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields: before and after/i);
  });

  it("returns 400 when after is missing", async () => {
    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({ before: { readOnly: [], readWrite: [] } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields: before and after/i);
  });

  it("returns 400 when before.readOnly is not an array", async () => {
    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({ before: { readOnly: "not-an-array", readWrite: [] }, after: { readOnly: [], readWrite: [] } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid before footprint/i);
  });

  it("returns 400 when after.readWrite is not an array", async () => {
    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({ before: { readOnly: [], readWrite: [] }, after: { readOnly: [], readWrite: "not-an-array" } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid after footprint/i);
  });

  it("returns diff with added entries on successful comparison", async () => {
    const xdr1 = "AAAA1";
    const xdr2 = "AAAA2";

    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({
        before: { readOnly: [xdr1], readWrite: [] },
        after: { readOnly: [xdr1, xdr2], readWrite: [] },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.added.readOnly).toContain(xdr2);
    expect(res.body.data.removed.readOnly).toEqual([]);
    expect(res.body.data.unchanged.readOnly).toContain(xdr1);
  });

  it("returns diff with removed entries on successful comparison", async () => {
    const xdr1 = "AAAA1";
    const xdr2 = "AAAA2";

    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({
        before: { readOnly: [xdr1, xdr2], readWrite: [] },
        after: { readOnly: [xdr1], readWrite: [] },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.added.readOnly).toEqual([]);
    expect(res.body.data.removed.readOnly).toContain(xdr2);
    expect(res.body.data.unchanged.readOnly).toContain(xdr1);
  });

  it("handles empty footprints", async () => {
    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({
        before: { readOnly: [], readWrite: [] },
        after: { readOnly: [], readWrite: [] },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.added.readOnly).toEqual([]);
    expect(res.body.data.removed.readOnly).toEqual([]);
    expect(res.body.data.unchanged.readOnly).toEqual([]);
  });

  it("handles readWrite footprint entries", async () => {
    const xdr1 = "BBBB1";
    const xdr2 = "BBBB2";

    const res = await request(app)
      .post("/api/v1/footprint/diff")
      .send({
        before: { readOnly: [], readWrite: [xdr1] },
        after: { readOnly: [], readWrite: [xdr1, xdr2] },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.added.readWrite).toContain(xdr2);
    expect(res.body.data.unchanged.readWrite).toContain(xdr1);
  });
});
