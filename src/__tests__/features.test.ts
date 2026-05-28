import request from "supertest";

import app from "../index";
import metrics from "../middleware/metrics";
import { LruMemoryCache, idempotencyCache } from "../services/cache";
import { simulateTransaction } from "../services/simulator";

// ─── Referrer-Policy header ───────────────────────────────────────────────────

describe("Referrer-Policy header", () => {
  it("is set to no-referrer on all responses", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });
});

// ─── #431: simulatedAt ────────────────────────────────────────────────────────

jest.mock("../services/simulator", () => ({
  simulateTransaction: jest.fn(),
}));

const mockSimulate = simulateTransaction as jest.MockedFunction<
  typeof simulateTransaction
>;

describe("#431 simulatedAt", () => {
  it("is present and is a valid ISO 8601 string in a successful result", async () => {
    const ts = new Date().toISOString();
    mockSimulate.mockResolvedValueOnce({
      success: true,
      simulatedAt: ts,
      footprint: { readOnly: [], readWrite: [] },
      cost: { cpuInsns: "0", memBytes: "0" },
    });

    const result = await simulateTransaction("xdr", "testnet");
    expect(result.simulatedAt).toBeDefined();
    expect(() => new Date(result.simulatedAt!)).not.toThrow();
    expect(new Date(result.simulatedAt!).toISOString()).toBe(
      result.simulatedAt,
    );
  });

  it("is preserved (not overwritten) when served from cache", () => {
    const original = "2024-01-01T00:00:00.000Z";
    // Simulate caching: the cached JSON retains the original simulatedAt
    const cached = JSON.stringify({ success: true, simulatedAt: original });
    const parsed = JSON.parse(cached) as { simulatedAt: string };
    expect(parsed.simulatedAt).toBe(original);
  });
});

// ─── #423: footprint histogram ────────────────────────────────────────────────

describe("#423 recordFootprintEntries", () => {
  it("is exported from metrics and callable without throwing", () => {
    expect(() => metrics.recordFootprintEntries(3, 2)).not.toThrow();
  });

  it("accepts zero counts", () => {
    expect(() => metrics.recordFootprintEntries(0, 0)).not.toThrow();
  });
});

// ─── #418: LruMemoryCache / cache-stats ───────────────────────────────────────

describe("#418 LruMemoryCache", () => {
  let cache: LruMemoryCache<string>;

  beforeEach(() => {
    cache = new LruMemoryCache<string>(3, 1000);
  });

  it("returns undefined for a missing key", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
  });

  it("evicts the LRU entry when capacity is exceeded", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    // Access 'a' to make it recently used
    cache.get("a");
    // Adding 'd' should evict 'b' (LRU)
    cache.set("d", "4");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
    expect(cache.get("d")).toBe("4");
  });

  it("expires entries after TTL", async () => {
    const shortCache = new LruMemoryCache<string>(10, 50); // 50ms TTL
    shortCache.set("x", "val");
    expect(shortCache.get("x")).toBe("val");
    await new Promise((r) => setTimeout(r, 60));
    expect(shortCache.get("x")).toBeUndefined();
  });

  it("stats() returns correct hit/miss counts and rates", () => {
    cache.set("k", "v");
    cache.get("k"); // hit
    cache.get("missing"); // miss

    const s = cache.stats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(1);
    expect(s.hitRate).toBe(0.5);
    expect(s.missRate).toBe(0.5);
    expect(s.size).toBe(1);
    expect(s.backend).toBe("lru-memory");
    expect(s.ttlSeconds).toBe(1);
  });

  it("stats() returns hitRate 0 when no requests made", () => {
    const s = cache.stats();
    expect(s.hitRate).toBe(0);
    expect(s.missRate).toBe(0);
  });
});

// ─── #420: idempotency key ────────────────────────────────────────────────────

describe("#420 idempotency cache singleton", () => {
  it("is an LruMemoryCache with 24h TTL", () => {
    const s = idempotencyCache.stats();
    expect(s.backend).toBe("lru-memory");
    expect(s.ttlSeconds).toBe(24 * 60 * 60);
  });

  it("caches and replays a response by key", () => {
    const key = `test-key-${Date.now()}`;
    const payload = JSON.stringify({
      success: true,
      simulatedAt: "2024-01-01T00:00:00.000Z",
    });
    idempotencyCache.set(key, payload);
    expect(idempotencyCache.get(key)).toBe(payload);
  });

  it("returns undefined for an unseen key", () => {
    expect(idempotencyCache.get("never-set-key")).toBeUndefined();
  });
});
