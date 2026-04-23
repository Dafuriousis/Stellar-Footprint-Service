# ADR 001: Caching Strategy

## Status

Accepted

## Context

The Stellar Footprint Service needs to optimize performance by reducing redundant computations and external API calls. Specifically, the service performs transaction simulations which involve calling the Stellar RPC network. These calls can be expensive in terms of latency and cost, especially when the same transaction (or similar transactions) are simulated multiple times.

We need to implement a caching layer to store simulation results for a configurable time-to-live (TTL) to improve response times and reduce the load on the Stellar RPC.

## Decision

We will implement an in-memory LRU (Least Recently Used) cache with an optional Redis backend for distributed caching and persistence.

### Why In-Memory LRU with Optional Redis?

- **In-Memory LRU**: Provides fast access times for the most recently used items, which is suitable for a service that may see bursts of repeated requests. It is simple to implement and has no external dependencies for the basic setup.
- **Optional Redis**: Allows for horizontal scaling and persistence of cache across service instances. By making Redis optional, we keep the service simple to run in development or in environments where a distributed cache is not necessary.

### Cache Design

- The cache will store the results of the `/simulate` endpoint (including footprint and cost data) keyed by a hash of the request body (XDR and network).
- Each cache entry will have a TTL (time-to-live) after which it will be evicted.
- The LRU mechanism will evict the least recently used items when the cache reaches its maximum size.
- If Redis is configured (via environment variables), the service will use Redis as the cache backend, falling back to in-memory LRU if Redis is not available or not configured.

## Consequences

### Positive

- **Improved Performance**: Reduced latency for repeated simulation requests.
- **Reduced External Calls**: Fewer requests to the Stellar RPC, lowering potential costs and improving reliability.
- **Flexibility**: Teams can start with the simple in-memory cache and adopt Redis as they scale.
- **Backward Compatibility**: The change is internal and does not affect the API contract.

### Negative

- **In-Memory Limitations**: The in-memory cache is limited to the memory of the single service instance and is not shared across instances or persistent across restarts.
- **Redis Complexity**: Introducing Redis adds an external dependency and operational overhead (though it is optional).
- **Cache Invalidation**: We are using a TTL-based approach, which may serve stale data if the underlying data on the Stellar ledger changes within the TTL window. However, for simulation data, which is based on the current state of the ledger, we accept that the TTL should be short (e.g., a few seconds) to balance performance and freshness.

## Alternatives Considered

1. **No Caching**: Rejected because it would not meet performance requirements under load.
2. **In-Memory Only (Simple Map)**: Rejected because it lacks eviction policies and could lead to unbounded memory growth.
3. **Redis Only**: Rejected because it would force all users to set up Redis, complicating local development and simple deployments.
4. **Using a Dedicated Caching Library (e.g., node-cache, lru-cache)**: We considered this but decided to implement a simple LRU in-house to avoid additional dependencies for the in-memory case. However, note that we might still use a well-tested library for the LRU implementation (like `lru-cache` for Node.js) if we decide to do so in the implementation.

## Implementation Notes

- The cache will be implemented as a wrapper around the simulation function.
- The cache key will be a SHA-256 hash of the canonicalized request body (to avoid issues with whitespace or property order).
- The TTL and maximum size of the LRU cache will be configurable via environment variables.
- Redis configuration will be via environment variables (REDIS_URL, etc.).

## Related Issues

- [Issue #28: Add caching to simulation results](https://github.com/Dafuriousis/Stellar-Footprint-Service/issues/28)
