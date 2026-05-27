# Caching Guide

The Stellar Footprint Service caches simulation results to avoid redundant RPC calls. Identical requests (same XDR + network) return the cached result instantly without hitting the Stellar RPC.

---

## Dual-Backend Strategy

The service selects a cache backend at startup based on whether `REDIS_URL` is set:

| Condition | Backend | Notes |
|---|---|---|
| `REDIS_URL` is set and Redis is reachable | **Redis** | Shared across all instances; survives restarts |
| `REDIS_URL` is unset or Redis fails to connect | **In-memory LRU** | Per-process; lost on restart |

If Redis connects but later drops, the service logs a warning and transparently falls back to the in-memory cache. No restart is required.

You can confirm which backend is active by checking the startup log:

```
Cache backend: Redis
# or
Cache backend: in-memory LRU (REDIS_URL not set)
```

---

## Cache Key Structure

Cache keys are deterministic SHA-256 hashes of the request's canonical JSON (keys sorted alphabetically):

```
sha256(JSON.stringify({ network: "testnet", xdr: "AAAAAgAAAAC..." }))
→ "a3f2c1d9e8b7..."
```

This means two requests with the same XDR and network always hit the same cache entry, regardless of field order in the request body.

---

## TTL Configuration

| Variable | Default | Description |
|---|---|---|
| `CACHE_TTL_SECONDS` | `60` | How long a cached result lives (seconds) |
| `CACHE_MAX_SIZE` | `500` | Maximum entries in the in-memory LRU cache |
| `REDIS_URL` | — | Full Redis connection URL (e.g. `redis://localhost:6379`) |
| `REDIS_HOST` | `redis` | Redis hostname (Docker Compose only) |
| `REDIS_PORT` | `6379` | Redis port (Docker Compose only) |

> **Note:** `REDIS_URL` takes precedence over `REDIS_HOST`/`REDIS_PORT`. Use `REDIS_URL` for production deployments (supports `rediss://` for TLS).

### Choosing a TTL

- **Short TTL (30–60 s):** Good for development or when ledger state changes frequently.
- **Longer TTL (5–30 min):** Appropriate for stable contracts where footprints rarely change. Reduces RPC load significantly under high traffic.

---

## Cache Invalidation

### Automatic expiry

Entries expire automatically after `CACHE_TTL_SECONDS`. No manual action needed.

### Manual flush

To immediately clear all cached entries (both Redis and in-memory):

```bash
curl -X DELETE http://localhost:3000/api/cache
```

Response:

```json
{ "message": "Cache cleared" }
```

**When to use `DELETE /cache`:**

- After deploying a new contract version that changes footprint structure
- When debugging unexpected cached responses
- After a ledger migration or network reset on testnet

---

## Redis in Docker Compose

The `docker-compose.yml` includes a Redis service. No extra configuration is needed for local development:

```bash
docker compose up
```

For production, use a managed Redis instance and set `REDIS_URL`:

```env
REDIS_URL=rediss://your-redis-host:6380
```

The `rediss://` scheme enables TLS. Most managed Redis providers (Upstash, Redis Cloud, AWS ElastiCache) require TLS in production.

---

## Further Reading

- [ADR 001 — Caching Strategy](../adr/001-caching-strategy.md)
- [Environment Variables Reference](../../README.md#-environment-variables)
