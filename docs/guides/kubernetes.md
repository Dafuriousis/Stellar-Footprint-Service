# Kubernetes Deployment Guide

This guide covers deploying the Stellar Footprint Service to a Kubernetes cluster using the manifests in `k8s/`.

---

## Prerequisites

- A running Kubernetes cluster (local: [minikube](https://minikube.sigs.k8s.io/) or [kind](https://kind.sigs.k8s.io/); cloud: EKS, GKE, AKS)
- `kubectl` configured to target your cluster (`kubectl cluster-info`)
- The service Docker image built and pushed to a registry accessible by your cluster

Build and push the image:

```bash
docker build -t your-registry/stellar-footprint-service:latest .
docker push your-registry/stellar-footprint-service:latest
```

Update the `image:` field in `k8s/deployment.yaml` to match your registry path.

---

## Manifests Overview

| File | Purpose |
|---|---|
| `k8s/deployment.yaml` | Pod spec, resource limits, health probes |
| `k8s/service.yaml` | ClusterIP service exposing port 80 → 3000 |
| `k8s/hpa.yaml` | Horizontal Pod Autoscaler (2–10 replicas) |
| `k8s/configmap.yaml` | Non-sensitive environment variables |
| `k8s/secret.yaml.template` | Template for sensitive values (RPC URLs, keys) |

---

## Applying the Manifests

### 1. Create a namespace (optional but recommended)

```bash
kubectl create namespace stellar-footprint
```

All subsequent commands use `-n stellar-footprint`. Omit the flag to deploy to the `default` namespace.

### 2. Configure secrets

Copy the secret template and fill in real values:

```bash
cp k8s/secret.yaml.template k8s/secret.yaml
```

Edit `k8s/secret.yaml`:

```yaml
stringData:
  TESTNET_RPC_URL: "https://soroban-testnet.stellar.org"
  MAINNET_RPC_URL: "https://mainnet.stellar.validationcloud.io/v1/<YOUR_API_KEY>"
  TESTNET_SECRET_KEY: "<your_testnet_secret_key>"
  MAINNET_SECRET_KEY: "<your_mainnet_secret_key>"
```

> **Never commit `k8s/secret.yaml`.** It is already listed in `.gitignore`. For production, prefer a secrets manager (AWS Secrets Manager, HashiCorp Vault, Sealed Secrets) over plain Kubernetes Secrets.

Apply the secret:

```bash
kubectl apply -f k8s/secret.yaml -n stellar-footprint
```

### 3. Apply all remaining manifests

```bash
kubectl apply -f k8s/configmap.yaml -n stellar-footprint
kubectl apply -f k8s/deployment.yaml -n stellar-footprint
kubectl apply -f k8s/service.yaml -n stellar-footprint
kubectl apply -f k8s/hpa.yaml -n stellar-footprint
```

Or apply the whole directory at once (secret must already exist):

```bash
kubectl apply -f k8s/ -n stellar-footprint
```

### 4. Verify the deployment

```bash
kubectl rollout status deployment/stellar-footprint-service -n stellar-footprint
kubectl get pods -n stellar-footprint
```

Expected output:

```
NAME                                        READY   STATUS    RESTARTS   AGE
stellar-footprint-service-6d9f8b7c4-abc12   1/1     Running   0          30s
stellar-footprint-service-6d9f8b7c4-def34   1/1     Running   0          30s
```

### 5. Test the service

Port-forward to test locally:

```bash
kubectl port-forward svc/stellar-footprint-service 8080:80 -n stellar-footprint
curl http://localhost:8080/api/health
```

---

## Configuring Secrets

The deployment loads secrets from the `stellar-footprint-secrets` Kubernetes Secret. To update a value without redeploying:

```bash
kubectl patch secret stellar-footprint-secrets \
  -n stellar-footprint \
  --type='json' \
  -p='[{"op":"replace","path":"/stringData/TESTNET_RPC_URL","value":"https://new-rpc-url"}]'

kubectl rollout restart deployment/stellar-footprint-service -n stellar-footprint
```

To update ConfigMap values (non-sensitive):

```bash
kubectl patch configmap stellar-footprint-config \
  -n stellar-footprint \
  --type='merge' \
  -p '{"data":{"LOG_LEVEL":"debug"}}'

kubectl rollout restart deployment/stellar-footprint-service -n stellar-footprint
```

---

## HPA Tuning

The HPA in `k8s/hpa.yaml` scales between **2 and 10 replicas** based on CPU utilisation, targeting **70%** average utilisation.

```yaml
minReplicas: 2
maxReplicas: 10
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Tuning guidelines:**

- Lower `averageUtilization` (e.g. `50`) to scale out earlier and reduce latency spikes under bursty load.
- Increase `maxReplicas` if you expect sustained high traffic.
- Ensure the Kubernetes Metrics Server is installed for HPA to function:
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```
- Check HPA status:
  ```bash
  kubectl get hpa -n stellar-footprint
  ```

---

## Health Check Configuration

The deployment configures two probes against the dedicated health endpoints:

| Probe | Path | Purpose |
|---|---|---|
| Liveness | `GET /api/health/live` | Restarts the container if the process is stuck |
| Readiness | `GET /api/health/ready` | Removes the pod from the load balancer until it is ready |

Current settings in `k8s/deployment.yaml`:

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

**Tuning guidelines:**

- Increase `initialDelaySeconds` on the liveness probe if the service takes longer to start (e.g. slow Redis connection).
- Decrease `periodSeconds` on the readiness probe for faster traffic recovery after a restart.
- The readiness probe checks Redis and the RPC circuit breaker state. If Redis is unavailable, the pod will be marked not-ready until the in-memory fallback activates.

---

## Updating the Deployment

```bash
# Pull latest image and trigger a rolling update
kubectl set image deployment/stellar-footprint-service \
  stellar-footprint-service=your-registry/stellar-footprint-service:new-tag \
  -n stellar-footprint

# Monitor the rollout
kubectl rollout status deployment/stellar-footprint-service -n stellar-footprint

# Roll back if needed
kubectl rollout undo deployment/stellar-footprint-service -n stellar-footprint
```

---

## Further Reading

- [k8s/README.md](../../k8s/README.md) — manifest-level reference
- [Deployment Guide](../deployment.md) — Railway, Render, Fly.io, and VPS options
