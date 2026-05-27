# Add Separate Liveness and Readiness Health Endpoints

## Overview

This PR implements dedicated health check endpoints to properly support Kubernetes liveness and readiness probes, replacing the single `/health` endpoint with specialized endpoints that serve different purposes in container orchestration.

## Changes

### New Endpoints

#### `GET /api/health/live`

- **Purpose**: Liveness probe - determines if the process is running
- **Response**: Always returns `200 OK` if the process is alive
- **Checks**: No external dependencies
- **Use Case**: Kubernetes uses this to determine if the container should be restarted

**Response Example:**

```json
{
  "status": "ok",
  "uptime": 12345.67,
  "version": "1.0.0",
  "timestamp": "2026-05-26T16:00:00.000Z"
}
```

#### `GET /api/health/ready`

- **Purpose**: Readiness probe - determines if the service can handle traffic
- **Response**: Returns `200 OK` if all dependencies are healthy, `503 Service Unavailable` otherwise
- **Checks**:
  - **Cache (Redis/Memory)**: Performs a write-read-delete cycle to verify cache functionality
  - **RPC Circuit Breaker**: Checks if the circuit breaker is in a healthy state (closed or half-open)
- **Use Case**: Kubernetes uses this to determine if the pod should receive traffic

**Response Example (Healthy):**

```json
{
  "status": "ready",
  "checks": {
    "cache": {
      "status": "healthy",
      "details": {
        "backend": "redis"
      }
    },
    "rpcCircuitBreaker": {
      "status": "healthy",
      "details": {
        "state": "closed",
        "failures": 0
      }
    }
  },
  "timestamp": "2026-05-26T16:00:00.000Z"
}
```

**Response Example (Unhealthy):**

```json
{
  "status": "not ready",
  "checks": {
    "cache": {
      "status": "unhealthy",
      "details": {
        "error": "Redis connection failed"
      }
    },
    "rpcCircuitBreaker": {
      "status": "unhealthy",
      "details": {
        "state": "open",
        "failures": 5,
        "retryAfter": 25
      }
    }
  },
  "timestamp": "2026-05-26T16:00:00.000Z"
}
```

#### `GET /api/health` (Deprecated)

- **Status**: Maintained for backward compatibility
- **Behavior**: Same as `/api/health/live`
- **Migration Path**: Clients should migrate to `/api/health/live`

### Infrastructure Updates

#### Kubernetes Deployment (`k8s/deployment.yaml`)

Updated probe configurations to use the new endpoints:

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

#### Docker Healthcheck (`healthcheck.js`)

Updated to use the new liveness endpoint:

```javascript
path: "/api/health/live";
```

### Code Changes

#### `src/api/controllers.ts`

- Added `liveness()` controller - simple process uptime check
- Added `readiness()` controller - comprehensive dependency health checks
- Imported `rpcCircuitBreaker` for circuit breaker state monitoring

#### `src/api/routes.ts`

- Added route: `GET /health/live` → `liveness`
- Added route: `GET /health/ready` → `readiness`
- Kept existing: `GET /health` → `health` (backward compatibility)

#### `src/constants.ts`

- Added `HTTP_STATUS.SERVICE_UNAVAILABLE: 503` constant

### Testing

#### `src/api/tests/health.test.ts`

Comprehensive test suite covering all scenarios:

**Liveness Tests:**

- ✅ Returns 200 when process is running
- ✅ Does not check external dependencies

**Readiness Tests:**

- ✅ Returns 200 when all checks pass (cache + circuit breaker healthy)
- ✅ Returns 503 when cache is unhealthy
- ✅ Returns 503 when circuit breaker is open
- ✅ Returns 503 when both checks fail
- ✅ Returns 200 when circuit breaker is half-open (recovering)

**Backward Compatibility:**

- ✅ `/health` endpoint still works as before

**Test Results:**

```
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

## Benefits

### 1. **Proper Kubernetes Integration**

- Liveness probes can restart unhealthy containers without false positives from temporary dependency issues
- Readiness probes prevent traffic routing to pods with unhealthy dependencies

### 2. **Better Observability**

- Detailed health status for each dependency
- Clear distinction between "process alive" and "ready to serve traffic"
- Actionable error messages with retry information

### 3. **Reduced Downtime**

- Pods with temporary Redis issues won't be killed, just marked not ready
- Circuit breaker state is visible in health checks
- Faster recovery with half-open circuit breaker considered healthy

### 4. **Backward Compatibility**

- Existing `/health` endpoint unchanged
- No breaking changes for current consumers
- Gradual migration path available

## Migration Guide

### For Kubernetes Users

The deployment manifest is already updated. Apply the changes:

```bash
kubectl apply -f k8s/deployment.yaml
```

### For Docker Users

Rebuild the image to pick up the updated healthcheck:

```bash
docker-compose up --build
```

### For API Consumers

If you're currently using `/api/health`, consider migrating:

- Use `/api/health/live` for simple uptime checks
- Use `/api/health/ready` for comprehensive health status

## Testing Performed

- ✅ Unit tests (8/8 passing)
- ✅ TypeScript compilation successful
- ✅ Linting passed
- ✅ Build successful

## Related Issues

Closes #412

## Checklist

- [x] Code follows project style guidelines
- [x] Tests added and passing
- [x] Documentation updated (inline comments)
- [x] Kubernetes manifests updated
- [x] Docker healthcheck updated
- [x] Backward compatibility maintained
- [x] No breaking changes
