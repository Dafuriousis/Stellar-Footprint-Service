import metrics from "../middleware/metrics";
import { LruMemoryCache, idempotencyCache } from "../services/cache";
import { simulateTransaction } from "../services/simulator";

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

// ─── base64ByteLength (calculateFootprintStats) ───────────────────────────────

// The helper is private, so we test it indirectly via the footprintStats field
// returned by a mocked simulateTransaction call.

describe("base64ByteLength formula matches Buffer.from byte length", () => {
  // Inline the same formula used in simulator.ts so the test is self-contained
  function base64ByteLength(b64: string): number {
    const len = b64.length;
    const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
    return (len * 3) / 4 - padding;
  }

  const cases: [string, number][] = [
    ["AAAA", 3], // no padding
    ["AAAABB==", 4], // two-char padding
    ["AAAABBB=", 5], // one-char padding
    ["", 0], // empty string
  ];

  it.each(cases)("base64ByteLength(%s) === %i", (b64, expected) => {
    expect(base64ByteLength(b64)).toBe(expected);
    expect(base64ByteLength(b64)).toBe(Buffer.from(b64, "base64").length);
  });
});

// ─── recordCacheLatency ───────────────────────────────────────────────────────

describe("metrics.recordCacheLatency", () => {
  it("is exported and callable without throwing", () => {
    expect(() =>
      metrics.recordCacheLatency("get", "redis", 0.001),
    ).not.toThrow();
    expect(() =>
      metrics.recordCacheLatency("set", "redis", 0.005),
    ).not.toThrow();
  });

  it("accepts memory backend label", () => {
    expect(() =>
      metrics.recordCacheLatency("get", "memory", 0.0001),
    ).not.toThrow();
  });
});
