# ADR 003: Rate Limiting Strategy

## Status

Accepted

## Context

The Stellar Footprint Service exposes a public HTTP API that proxies calls to the Stellar RPC network. Without protection, a single client can exhaust the service's concurrency budget, spike RPC costs, or use the `/simulate` endpoint as a vector for brute-force enumeration of contract states.

Two distinct threat profiles must be addressed:

1. **Burst / volumetric abuse** — a client sends far more requests per minute than any legitimate use case requires, saturating RPC connections and degrading service for other users.
2. **Brute-force / credential stuffing** — a client sends repeated requests that fail (invalid XDR, wrong network, contract panics) to probe contract state or discover valid inputs.

A single rate-limiting primitive cannot serve both profiles well without either being too restrictive for normal traffic or too permissive for sustained low-and-slow abuse.

## Decision

We implement **two independent middleware layers**, each targeting one threat profile:

### Layer 1 — General Rate Limiter (`express-rate-limit`)

`src/middleware/rateLimiter.ts` wraps the `POST /simulate` route with a sliding-window counter using the `express-rate-limit` library.

- **Window**: configurable via `RATE_LIMIT_WINDOW_MS` (default 60 000 ms)
- **Limit**: configurable via `RATE_LIMIT_MAX` (default 60 requests per window)
- **Key**: client IP address (standard `express-rate-limit` behaviour)
- **Headers**: both draft-7 `RateLimit-*` standard headers and legacy `X-RateLimit-*` headers are emitted so that old and new clients both see the state
- **Response on violation**: `429` with a JSON body containing `error`, `message`, and `retryAfter` (seconds)

This layer only applies to `/simulate`. Health, decode, and utility endpoints are not rate-limited to avoid blocking monitoring tools and load-balancer probes.

### Layer 2 — Brute Force Protection (`bruteForce` middleware)

`src/middleware/bruteForce.ts` is a lightweight in-process IP tracker applied after the general rate limiter.

- **Window**: configurable via `BRUTE_FORCE_WINDOW_MS` (default 60 000 ms)
- **Delay threshold**: configurable via `BRUTE_FORCE_DELAY_THRESHOLD` (default 10 failures); once reached, each subsequent request from that IP incurs an artificial delay of `BRUTE_FORCE_DELAY_MS` (default 5 000 ms)
- **Block threshold**: configurable via `BRUTE_FORCE_BLOCK_THRESHOLD` (default 20 failures); once reached, the IP is hard-blocked for `BRUTE_FORCE_BLOCK_MS` (default 300 000 ms = 5 min)
- **Storage**: in-process `Map<string, IpRecord>` — intentionally not shared across replicas (see Consequences)
- **Failure recording**: callers invoke `recordFailure(ip)` after a request results in a simulation error, to increment the counter for that IP

### Why Two Layers?

| Concern | Layer 1 | Layer 2 |
|---|---|---|
| Normal burst traffic | Caps total volume per IP | Not involved |
| Repeated failures / probing | Not aware of success/failure | Delays then blocks |
| Applies to | `/simulate` route only | Any route that calls `recordFailure` |
| State | Stateless (window counter) | Stateful (success/failure count) |

Combining both layers means a client that sends 60 legitimate requests per minute is not penalised, while a client that sends even 20 *failing* requests within a minute is blocked without needing to hit the global rate limit first.

### Configuration Approach

All thresholds are read from environment variables with safe defaults so that operators can tune per-deployment without code changes:

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_MAX` | `60` | Maximum requests per window (Layer 1) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window duration in ms (Layer 1) |
| `BRUTE_FORCE_DELAY_THRESHOLD` | `10` | Failure count before adding delay (Layer 2) |
| `BRUTE_FORCE_BLOCK_THRESHOLD` | `20` | Failure count before hard block (Layer 2) |
| `BRUTE_FORCE_WINDOW_MS` | `60000` | Window duration for failure counting (Layer 2) |
| `BRUTE_FORCE_DELAY_MS` | `5000` | Artificial delay added after threshold (Layer 2) |
| `BRUTE_FORCE_BLOCK_MS` | `300000` | Hard block duration (Layer 2) |

### Redis vs In-Memory Trade-offs

Both layers currently use **in-process state**. This was a deliberate choice for the initial implementation:

**In-memory (current)**

- Zero operational dependencies — works in local dev and single-replica deployments with no extra setup
- Sub-millisecond counter increments with no network round-trip
- State is lost on restart, which is acceptable: a restarted pod is effectively a new IP from the perspective of an attacker

**Redis (future consideration)**

- Required for accurate enforcement across multiple replicas; without it, a client can bypass Layer 1 by spreading requests across pods
- Adds a network round-trip on every request (~1–5 ms) and a hard dependency on Redis availability
- `express-rate-limit` supports a Redis store via `rate-limit-redis`; Layer 2 would need a custom Redis-backed store

The trade-off: in-process state is sufficient when running a single replica or when approximate enforcement is acceptable. Shared Redis enforcement should be added when horizontal scaling makes per-pod limits meaningfully bypassable.

## Consequences

### Positive

- **Immediate protection** with no external dependencies for common single-instance deployments
- **Configurable without code changes** — operators can tighten or relax limits via environment variables
- **Standard headers** (`RateLimit-Policy`, `RateLimit`, `Retry-After`) let well-behaved clients back off automatically
- **Separation of concerns** — volumetric and brute-force threats are handled by independent, testable units

### Negative

- **No cross-replica coordination**: In a multi-pod deployment, each pod applies limits independently. A client that spreads traffic across N pods can make up to N × `RATE_LIMIT_MAX` requests before any single pod triggers a 429.
- **IP accuracy**: Limits key on `req.ip`. Behind a NAT or shared proxy, all users share one IP counter. Operators running behind a load balancer must ensure `trust proxy` is set so `req.ip` reflects the real client IP, not the proxy.
- **Memory growth (Layer 2)**: The `ipRecords` Map grows unboundedly if many unique IPs make failing requests. A future improvement is to add a periodic sweep that removes records whose windows have expired.

## Alternatives Considered

1. **Single rate limiter for everything**: Rejected. A global limit cannot distinguish between a bursty-but-legitimate client and a low-rate brute-force attacker.

2. **Redis-backed rate limiting from day one**: Rejected for the initial implementation due to added operational complexity. The in-process approach covers the common single-replica deployment and can be upgraded without changing the API contract.

3. **API key authentication**: Considered as a complement to IP-based limiting — keys allow per-client quotas and attribution. Deferred; the service is currently designed for public, unauthenticated access.

4. **External WAF / API gateway**: Suitable for production-scale deployments but out of scope for the application layer. The middleware approach is self-contained and works in any deployment topology.

## Related Issues

- [Issue #77: Add ADR 003 for rate limiting strategy](https://github.com/Dafuriousis/Stellar-Footprint-Service/issues/77)
