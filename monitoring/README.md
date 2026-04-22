# 📊 Monitoring Setup

This directory contains monitoring configuration for the Stellar Footprint Service using Prometheus and Grafana.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Stellar Service │───▶│   Prometheus    │───▶│     Grafana     │
│   (Port 3000)   │    │   (Port 9090)   │    │   (Port 3001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📈 Metrics Tracked

### Core Service Metrics
- **Request Rate**: HTTP requests per second
- **Error Rate**: Percentage of 4xx/5xx responses
- **Latency Percentiles**: P50, P95, P99 response times
- **Cache Hit Rate**: Simulation cache effectiveness

### Additional Metrics
- **Active Simulations**: Current concurrent requests
- **Status Code Distribution**: Breakdown of HTTP responses
- **Network Usage**: Mainnet vs Testnet usage patterns

## 🚀 Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all services (Stellar service, Prometheus, Grafana, Redis)
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin` (change in production)
- **Prometheus**: http://localhost:9090
- **Stellar Service**: http://localhost:3000

### 3. Import Dashboard

The Grafana dashboard is automatically provisioned, but you can also manually import:

1. Go to Grafana → Dashboards → Import
2. Upload `grafana-dashboard.json`
3. Select Prometheus as data source

## 📊 Dashboard Panels

### Request Rate Panel
- **Metric**: `rate(http_requests_total{job="stellar-footprint-service"}[5m])`
- **Description**: Shows requests per second by method and route
- **Alerts**: Consider alerting if rate drops to 0 or spikes unexpectedly

### Error Rate Panel
- **Metric**: `(rate(http_requests_total{status_code=~"4..|5.."}[5m]) / rate(http_requests_total[5m])) * 100`
- **Description**: Percentage of failed requests
- **Thresholds**: 
  - Green: < 1%
  - Yellow: 1-5%
  - Red: > 5%

### Latency Percentiles Panel
- **Metrics**: 
  - P50: `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))`
  - P95: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
  - P99: `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))`
- **Description**: Response time distribution
- **Target**: P95 < 500ms, P99 < 1000ms

### Cache Hit Rate Panel
- **Metric**: `(rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) * 100`
- **Description**: Cache effectiveness for simulation results
- **Target**: > 80% hit rate

## 🔧 Configuration

### Environment Variables

Create a `.env` file for production:

```env
# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=your_secure_password

# Stellar Service
TESTNET_RPC_URL=https://soroban-testnet.stellar.org
MAINNET_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY
TESTNET_SECRET_KEY=your_testnet_secret
MAINNET_SECRET_KEY=your_mainnet_secret
```

### Prometheus Configuration

Edit `prometheus.yml` to add more scrape targets:

```yaml
scrape_configs:
  - job_name: 'stellar-footprint-service'
    static_configs:
      - targets: ['stellar-footprint-service:3000']
    scrape_interval: 5s
```

### Grafana Provisioning

Dashboards are automatically loaded from:
- `grafana/provisioning/dashboards/`
- `grafana/provisioning/datasources/`

## 🚨 Alerting

### Recommended Alerts

1. **High Error Rate**
   ```yaml
   - alert: HighErrorRate
     expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
     for: 2m
     labels:
       severity: critical
   ```

2. **High Latency**
   ```yaml
   - alert: HighLatency
     expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
     for: 5m
     labels:
       severity: warning
   ```

3. **Low Cache Hit Rate**
   ```yaml
   - alert: LowCacheHitRate
     expr: (rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) < 0.5
     for: 10m
     labels:
       severity: warning
   ```

## 🔍 Troubleshooting

### No Data in Grafana

1. Check Prometheus targets: http://localhost:9090/targets
2. Verify service is exposing metrics: `curl http://localhost:3000/metrics`
3. Check Grafana data source configuration

### Service Not Starting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs stellar-footprint-service

# Check health
docker-compose -f docker-compose.prod.yml exec stellar-footprint-service wget -qO- http://localhost:3000/health
```

### Prometheus Not Scraping

1. Verify network connectivity between containers
2. Check Prometheus configuration syntax
3. Ensure service labels are correct in docker-compose

## 📚 Metrics Reference

### Expected Prometheus Metrics

The service should expose these metrics:

```
# HTTP metrics
http_requests_total{method, route, status_code}
http_request_duration_seconds_bucket{method, route}

# Cache metrics
cache_hits_total{cache_type}
cache_misses_total{cache_type}

# Business metrics
stellar_simulations_total{network, success}
active_simulations
```

### Custom Metrics Implementation

To add custom metrics to the service, install `prom-client`:

```bash
pnpm add prom-client
```

Example implementation:

```typescript
import client from 'prom-client';

// Create metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Use in middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });
  });
  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

## 🔐 Security Considerations

1. **Change default Grafana password**
2. **Use HTTPS in production**
3. **Restrict Prometheus access**
4. **Monitor for sensitive data in metrics**
5. **Regular security updates**

## 📈 Performance Tuning

### Prometheus
- Adjust `scrape_interval` based on needs
- Configure retention policies
- Use recording rules for complex queries

### Grafana
- Optimize dashboard queries
- Use appropriate time ranges
- Cache dashboard results

### Service
- Implement metric sampling for high-traffic
- Use histogram buckets appropriate for your latency distribution
- Consider metric cardinality impact

---

**Need help?** Check the [main README](../README.md) or open an issue.