import { simulateTransaction } from "@services/simulator";
import request from "supertest";

import app from "../../index";

jest.mock("@services/simulator");
jest.mock("@middleware/metrics", () => ({
  __esModule: true,
  metricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  default: {
    incrementActiveSimulations: jest.fn(),
    decrementActiveSimulations: jest.fn(),
    recordSimulation: jest.fn(),
    recordSimulationDuration: jest.fn(),
  },
}));

const mockSimulate = simulateTransaction as jest.MockedFunction<
  typeof simulateTransaction
>;

const VALID_XDR =
  "AAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZwAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAABAAAAAQAAAAAAAAAAAAAAAfK5hNUAAABAIbPVF4x6vSLx/J3T0SDhvTNtytA/BNO+qMJ74p/b3Y8xpBhR7xzy68FuEyffaF9fNXHEC+77WK+oOJpfon1tCg==";

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

describe("POST /api/v1/simulate/batch concurrency", () => {
  beforeEach(() => jest.clearAllMocks());

  it("processes all transactions and returns results for each", async () => {
    mockSimulate.mockResolvedValue(mockResult);

    const transactions = Array.from({ length: 5 }, () => ({ xdr: VALID_XDR }));
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(5);
    expect(mockSimulate).toHaveBeenCalledTimes(5);
  });

  it("processes transactions in chunks — concurrent calls never exceed BATCH_CONCURRENCY", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    mockSimulate.mockImplementation(() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise((resolve) =>
        setImmediate(() => {
          inFlight--;
          resolve(mockResult);
        }),
      );
    });

    const transactions = Array.from({ length: 8 }, () => ({ xdr: VALID_XDR }));
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(8);
    // Default BATCH_CONCURRENCY is 5; max in-flight should not exceed it
    expect(maxInFlight).toBeLessThanOrEqual(5);
  });

  it("returns error entries for failed transactions without aborting the batch", async () => {
    mockSimulate
      .mockResolvedValueOnce(mockResult)
      .mockRejectedValueOnce(new Error("RPC error"))
      .mockResolvedValue(mockResult);

    const transactions = Array.from({ length: 3 }, () => ({ xdr: VALID_XDR }));
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results[1]).toMatchObject({
      success: false,
      error: "RPC error",
    });
  });

  it("passes per-transaction ledgerSequence to simulateTransaction", async () => {
    mockSimulate.mockResolvedValue(mockResult);

    const transactions = [
      { xdr: VALID_XDR, ledgerSequence: 100 },
      { xdr: VALID_XDR },
      { xdr: VALID_XDR, ledgerSequence: 200 },
    ];
    const res = await request(app)
      .post("/api/v1/simulate/batch")
      .send({ transactions, network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(mockSimulate).toHaveBeenNthCalledWith(
      1,
      VALID_XDR,
      "testnet",
      expect.anything(),
      100,
    );
    expect(mockSimulate).toHaveBeenNthCalledWith(
      2,
      VALID_XDR,
      "testnet",
      expect.anything(),
      undefined,
    );
    expect(mockSimulate).toHaveBeenNthCalledWith(
      3,
      VALID_XDR,
      "testnet",
      expect.anything(),
      200,
    );
  });
});
