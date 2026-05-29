import { LruMemoryCache, buildCacheKey } from "./cache";

jest.mock("ioredis");
jest.mock("../middleware/metrics", () => ({
  __esModule: true,
  default: { recordCacheLatency: jest.fn() },
}));
jest.mock("../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// LruMemoryCache (synchronous)
// ---------------------------------------------------------------------------

describe("LruMemoryCache", () => {
  it("LRU eviction: evicts the least-recently-used entry when maxSize is reached", () => {
    const cache = new LruMemoryCache<string>(3, 60_000);
    cache.set("a", "A");
    cache.set("b", "B");
    cache.set("c", "C");
    // Access 'a' so it becomes MRU; 'b' becomes LRU
    cache.get("a");
    cache.set("d", "D"); // should evict 'b'

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
    expect(cache.get("c")).toBe("C");
    expect(cache.get("d")).toBe("D");
  });

  it("TTL expiry: returns undefined for expired entries", async () => {
    const cache = new LruMemoryCache<string>(10, 50); // 50 ms TTL
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get("key")).toBeUndefined();
  });

  it("flush via delete: delete removes a specific entry", () => {
    const cache = new LruMemoryCache<number>(10, 60_000);
    cache.set("x", 1);
    cache.set("y", 2);
    cache.delete("x");
    expect(cache.get("x")).toBeUndefined();
    expect(cache.get("y")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Async cache service — flush()
// ---------------------------------------------------------------------------

describe("async CacheService (in-memory backend)", () => {
  let getCache: () => import("./cache").CacheService;
  let setCache: (c: import("./cache").CacheService) => void;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    jest.resetModules();
    jest.mock("../middleware/metrics", () => ({
      __esModule: true,
      default: { recordCacheLatency: jest.fn() },
    }));
    jest.mock("../utils/logger", () => ({
      logger: { info: jest.fn(), warn: jest.fn() },
    }));
    jest.mock("ioredis");
    const mod = require("./cache");
    getCache = mod.getCache;
    setCache = mod.setCache;
  });

  it("flush() clears all entries", async () => {
    const cache = getCache();
    await cache.set("k1", "v1", 10_000);
    await cache.set("k2", "v2", 10_000);
    await cache.flush();
    expect(await cache.get("k1")).toBeNull();
    expect(await cache.get("k2")).toBeNull();
  });

  it("backend is memory when REDIS_URL is not set", () => {
    expect(getCache().backend).toBe("memory");
  });
});

// ---------------------------------------------------------------------------
// Redis fallback on connection error
// ---------------------------------------------------------------------------

describe("Redis fallback on connection error", () => {
  afterEach(() => {
    delete process.env.REDIS_URL;
    jest.resetModules();
  });

  it("falls back to in-memory cache when Redis emits an error", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    jest.resetModules();

    const { EventEmitter } = require("events") as typeof import("events");
    const fakeClient = Object.assign(new EventEmitter(), {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
      flushdb: jest.fn().mockResolvedValue("OK"),
    });

    jest.doMock("ioredis", () => jest.fn().mockReturnValue(fakeClient));
    jest.doMock("../middleware/metrics", () => ({
      __esModule: true,
      default: { recordCacheLatency: jest.fn() },
    }));
    jest.doMock("../utils/logger", () => ({
      logger: { info: jest.fn(), warn: jest.fn() },
    }));

    const { getCache } = require("./cache");

    const first = getCache();
    expect(first.backend).toBe("redis");

    fakeClient.emit("error", new Error("ECONNREFUSED"));

    const second = getCache();
    expect(second.backend).toBe("memory");
  });
});

// ---------------------------------------------------------------------------
// buildCacheKey
// ---------------------------------------------------------------------------

describe("buildCacheKey", () => {
  it("produces consistent hashes for identical input", () => {
    const a = buildCacheKey({ xdr: "abc", network: "testnet" });
    const b = buildCacheKey({ xdr: "abc", network: "testnet" });
    expect(a).toBe(b);
  });

  it("is order-independent (canonical key)", () => {
    const a = buildCacheKey({ network: "testnet", xdr: "abc" });
    const b = buildCacheKey({ xdr: "abc", network: "testnet" });
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = buildCacheKey({ xdr: "abc" });
    const b = buildCacheKey({ xdr: "xyz" });
    expect(a).not.toBe(b);
  });

  it("returns a 64-character hex SHA-256 string", () => {
    const key = buildCacheKey({ xdr: "abc" });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
