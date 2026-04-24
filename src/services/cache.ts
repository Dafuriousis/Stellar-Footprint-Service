import { createHash } from "crypto";

import Redis from "ioredis";

import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  flush(): Promise<void>;
  /** Which backend is currently active */
  readonly backend: "redis" | "memory";
}

// ---------------------------------------------------------------------------
// In-memory LRU cache
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SIZE = 500;

class LruMemoryCache implements CacheService {
  readonly backend = "memory" as const;

  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxSize: number;

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // LRU: move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    // Evict oldest entry when at capacity
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }

    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Redis cache adapter
// ---------------------------------------------------------------------------

class RedisCache implements CacheService {
  readonly backend = "redis" as const;

  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    // PX = millisecond precision TTL
    await this.client.set(key, JSON.stringify(value), "PX", ttlMs);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }
}

// ---------------------------------------------------------------------------
// Factory — builds the right backend, falls back to memory on Redis failure
// ---------------------------------------------------------------------------

let _cache: CacheService | null = null;

export function getCache(): CacheService {
  if (_cache) return _cache;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const client = new Redis(redisUrl, {
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: false,
      });

      client.on("error", (err: Error) => {
        logger.warn(
          "Redis error — falling back to in-memory cache",
          err.message,
        );
        _cache = new LruMemoryCache();
      });

      client.on("connect", () => {
        logger.info("Redis cache connected");
      });

      client.on("reconnecting", () => {
        logger.warn("Redis reconnecting…");
      });

      _cache = new RedisCache(client);
      logger.info("Cache backend: Redis", { url: redisUrl });
    } catch (err) {
      logger.warn(
        "Failed to initialise Redis — falling back to in-memory cache",
        err,
      );
      _cache = new LruMemoryCache();
    }
  } else {
    _cache = new LruMemoryCache();
    logger.info("Cache backend: in-memory LRU (REDIS_URL not set)");
  }

  return _cache;
}

/**
 * Replace the active cache instance.
 * Exposed for testing and for the fallback swap on Redis errors.
 */
export function setCache(instance: CacheService): void {
  _cache = instance;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a deterministic cache key from arbitrary request data.
 * Uses SHA-256 so key length is always fixed regardless of input size.
 */
export function buildCacheKey(data: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(data)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = data[k];
        return acc;
      }, {}),
  );
  return createHash("sha256").update(canonical).digest("hex");
}
