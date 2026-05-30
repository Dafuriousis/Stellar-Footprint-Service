import request from "supertest";

import app from "../../index";

jest.mock("@middleware/metrics", () => ({
  __esModule: true,
  metricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
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

// Valid Soroban InvokeHostFunction transaction XDR (testnet)
const VALID_TX_XDR =
  "AAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZwAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAABAAAAAQAAAAAAAAAAAAAAAfK5hNUAAABAIbPVF4x6vSLx/J3T0SDhvTNtytA/BNO+qMJ74p/b3Y8xpBhR7xzy68FuEyffaF9fNXHEC+77WK+oOJpfon1tCg==";

// Valid ContractData ledger key XDR
const VALID_LEDGER_KEY_XDR =
  "AAAABgAAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAABQAAAAB";

const BASE = "/api/v1/decode";

describe("GET /api/v1/decode", () => {
  describe("missing or invalid xdr → 400", () => {
    it("returns 400 when xdr param is absent", async () => {
      const res = await request(app).get(BASE);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/xdr/i);
    });

    it("returns 400 when xdr is an empty string", async () => {
      const res = await request(app).get(BASE).query({ xdr: "" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid base64 XDR", async () => {
      const res = await request(app)
        .get(BASE)
        .query({ xdr: "not-valid-base64!!!", type: "transaction" });
      expect(res.status).toBe(400);
    });
  });

  describe("invalid type param → 400", () => {
    it("returns 400 for an unrecognised type", async () => {
      const res = await request(app)
        .get(BASE)
        .query({ xdr: VALID_TX_XDR, type: "unknown_type" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid type/);
    });
  });

  describe("valid inputs → 200 decoded JSON", () => {
    it("decodes a transaction XDR (default type)", async () => {
      const res = await request(app).get(BASE).query({ xdr: VALID_TX_XDR });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, type: "transaction" });
      expect(res.body.decoded).toBeDefined();
    });

    it("decodes a transaction XDR with explicit type=transaction", async () => {
      const res = await request(app)
        .get(BASE)
        .query({ xdr: VALID_TX_XDR, type: "transaction" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, type: "transaction" });
    });

    it("decodes a ledger_key XDR", async () => {
      const res = await request(app)
        .get(BASE)
        .query({ xdr: VALID_LEDGER_KEY_XDR, type: "ledger_key" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, type: "ledger_key" });
      expect(res.body.decoded).toBeDefined();
    });
  });
});
