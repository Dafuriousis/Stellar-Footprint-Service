export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  size: number;
  backend: string;
  ttlSeconds: number;
}

export interface CacheService<V> {
  get(key: string): V | undefined;
  set(key: string, value: V, ttlMs?: number): void;
  stats(): CacheStats;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruMemoryCache<V> implements CacheService<V> {
  private readonly store = new Map<string, Entry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxSize: number,
    private readonly defaultTtlMs: number,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    // LRU: move to end
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict least-recently-used (first entry)
      this.store.delete(this.store.keys().next().value as string);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      missRate: total === 0 ? 0 : this.misses / total,
      size: this.store.size,
      backend: "lru-memory",
      ttlSeconds: this.defaultTtlMs / 1000,
    };
  }
}

// Singleton idempotency cache: 24h TTL, max 10 000 entries
export const idempotencyCache = new LruMemoryCache<string>(
  10_000,
  24 * 60 * 60 * 1000,
);
