# Kubernetes Configuration Files

This directory contains Kubernetes manifests for deploying the Stellar Footprint Service.

## Files

### deployment.yaml
Main deployment manifest that defines the service pod specifications, resource requests/limits, and health checks.

### service.yaml
Service manifest that exposes the deployment to the cluster and external traffic.

### hpa.yaml
Horizontal Pod Autoscaler configuration for automatic scaling based on metrics.

### configmap.yaml
ConfigMap containing non-sensitive environment variables that can be updated without rebuilding the application.

Configuration includes:
- Application environment (NODE_ENV, PORT, LOG_LEVEL)
- Cache settings (TTL, max size)
- RPC client settings (retries, timeout)
- Rate limiting configuration
- Batch processing limits
- Circuit breaker settings

### secret.yaml.template
Template for Kubernetes Secret containing sensitive environment variables like API keys and RPC URLs.

**IMPORTANT**: This is a template file and should NOT be committed with real secrets.

To create your own secret from this template:
```bash
cp k8s/secret.yaml.template k8s/secret.yaml
# Edit k8s/secret.yaml with actual values
# Add k8s/secret.yaml to .gitignore
kubectl apply -f k8s/secret.yaml
```

## Deployment

1. Create the namespace (optional):
```bash
kubectl create namespace stellar-footprint
```

2. Create the Secret from the template:
```bash
cp k8s/secret.yaml.template k8s/secret.yaml
# Edit with real values
kubectl apply -f k8s/secret.yaml -n stellar-footprint
```

3. Apply all manifests:
```bash
kubectl apply -f k8s/ -n stellar-footprint
```

## Environment Variables

### From ConfigMap (configmap.yaml)
- NODE_ENV: Application environment
- PORT: Server port
- LOG_LEVEL: Logging level
- CACHE_TTL_MS: Cache time-to-live
- CACHE_MAX_SIZE: Maximum cache entries
- RPC_MAX_RETRIES: RPC retry attempts
- RPC_TIMEOUT_MS: RPC timeout
- RATE_LIMIT_WINDOW_MS: Rate limit window
- RATE_LIMIT_MAX_REQUESTS: Rate limit threshold
- BATCH_MAX_SIZE: Maximum batch size
- CIRCUIT_BREAKER_THRESHOLD: Circuit breaker threshold
- CIRCUIT_BREAKER_TIMEOUT_MS: Circuit breaker timeout

### From Secret (secret.yaml)
- TESTNET_RPC_URL: Stellar Testnet RPC endpoint
- MAINNET_RPC_URL: Stellar Mainnet RPC endpoint

## Updating Configuration

To update ConfigMap values:
```bash
kubectl set env configmap/stellar-footprint-config LOG_LEVEL=debug -n stellar-footprint
```

Restart pods to apply changes:
```bash
kubectl rollout restart deployment/stellar-footprint-service -n stellar-footprint
```

To update Secret values:
```bash
kubectl set env secret/stellar-footprint-secrets TESTNET_RPC_URL=<new-url> -n stellar-footprint
```
