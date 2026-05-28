# ADR 002: Circuit Breaker for RPC Calls

## Status

Accepted

## Context

The Stellar Footprint Service depends entirely on the Stellar RPC network to simulate transactions. When the RPC endpoint is slow or unavailable, requests queue up and wait for the full `SIMULATE_TIMEOUT_MS` (default 30 s) before failing. Under load, this causes thread saturation, memory pressure, and cascading latency across the service — even for clients whose requests would eventually succeed.

We need a mechanism that detects sustained RPC failures and stops forwarding traffic to the RPC until it has had a chance to recover, while automatically resuming once it becomes healthy again.

## Decision

We will implement a three-state circuit breaker (`closed → open → half-open`) that wraps every outbound RPC call.

### State Machine

| State       | Behaviour                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------- |
| **closed**  | Normal operation. Every call is forwarded to the RPC. Failures are counted.                 |
| **open**    | RPC is considered unhealthy. Calls are rejected immediately with a `503` and a `Retry-After` header. |
| **half-open** | After `CB_RECOVERY_MS` the breaker allows a single probe call. Success → closed; failure → open again. |

### Transition Rules

- `closed → open`: consecutive failure count reaches `CB_FAILURE_THRESHOLD`
- `open → half-open`: `CB_RECOVERY_MS` milliseconds have elapsed since the breaker opened
- `half-open → closed`: the probe call succeeds
- `half-open → open`: the probe call fails

### Configuration

Both thresholds are configurable via environment variables so they can be tuned per deployment without code changes:

| Variable               | Default  | Description                                          |
| ---------------------- | -------- | ---------------------------------------------------- |
| `CB_FAILURE_THRESHOLD` | `5`      | Consecutive failures before the breaker opens        |
| `CB_RECOVERY_MS`       | `30000`  | Milliseconds to wait before attempting recovery      |

### Implementation

The circuit breaker is implemented as a generic `CircuitBreaker` class in `src/utils/circuitBreaker.ts`. A single shared instance (`rpcCircuitBreaker`) is exported and used by the simulation service layer. Any function can be wrapped via `rpcCircuitBreaker.call(() => fn())`.

When the breaker is open, the `call` method throws an error with `circuitOpen: true` and a `retryAfter` (seconds) field, which the request handler maps to a `503 Service Unavailable` with a `Retry-After` header.

## Consequences

### Positive

- **Fast failure**: Clients receive a `503` immediately rather than waiting for the full timeout, improving perceived reliability.
- **Prevents pile-up**: Stops the RPC from being flooded with retries while it is recovering.
- **Automatic recovery**: The half-open probe removes the need for manual intervention when the RPC comes back online.
- **Observable**: The breaker state and failure count are exposed via `GET /health` for monitoring and alerting.
- **Configurable**: Thresholds can be tuned per environment without code changes.

### Negative

- **False positives**: A transient spike of failures (e.g. a single slow ledger close) can open the breaker and reject subsequent requests that would have succeeded.
- **Single instance**: The in-process circuit breaker is not shared across service replicas; in a multi-instance deployment each replica maintains its own state, meaning the breaker may open on some pods but not others.
- **Probe latency**: In half-open state, the first request bears the full RPC latency before the breaker transitions to closed.

## Alternatives Considered

1. **No circuit breaker — rely solely on timeouts**: Rejected. Under sustained RPC failure every in-flight request still holds a connection and thread for the full `SIMULATE_TIMEOUT_MS`, causing resource exhaustion under any meaningful load.

2. **Simple boolean flag (manually toggled)**: Rejected. A flag requires human intervention to reset and does not self-heal; operational overhead is unacceptable for an automated service.

3. **External circuit breaker via service mesh (e.g. Istio, Envoy)**: Considered for future scaling scenarios but rejected for the initial implementation because it introduces significant infrastructure complexity and is out of scope for a single-service deployment. Can be revisited when the service is deployed into a service mesh.

4. **Library-based circuit breaker (e.g. `opossum`)**: Considered to reduce implementation burden. Rejected in favour of a thin in-house implementation to avoid adding a runtime dependency for ~100 lines of well-understood logic. May be reconsidered if requirements grow to include bulkheads or fallback strategies.

## Implementation Notes

- The circuit breaker guards only outbound RPC calls — validation and cache hits are unaffected and continue to serve normally when the breaker is open.
- The `retryAfter` value returned in the `503` response is calculated from `openedAt + recoveryTimeMs - Date.now()` and is always at least 1 second to comply with the `Retry-After` header semantics.
- Tests must reset the exported `rpcCircuitBreaker` instance between test cases to prevent state leakage.

## Related Issues

- [Issue #76: Add circuit breaker for RPC calls](https://github.com/Dafuriousis/Stellar-Footprint-Service/issues/76)
