# Grafana Dashboard for Service Metrics

## 📋 Description

This PR adds comprehensive monitoring infrastructure for the Stellar Footprint Service using Prometheus and Grafana.

**Closes #37**

## ✨ What's New

### Grafana Dashboard

- ✅ Request Rate panel - tracks HTTP requests per second
- ✅ Error Rate panel - monitors 4xx/5xx response percentages
- ✅ Latency Percentiles panel - displays P50, P95, P99 response times
- ✅ Cache Hit Rate panel - shows simulation cache effectiveness
- ✅ Active Simulations panel - tracks concurrent requests
- ✅ Status Code Distribution panel - pie chart of HTTP responses
- ✅ Network Usage Distribution panel - mainnet vs testnet usage

### Infrastructure

- ✅ Docker Compose production setup with Prometheus, Grafana, and Redis
- ✅ Prometheus metrics collection and scraping configuration
- ✅ Automatic Grafana dashboard provisioning
- ✅ Health check endpoint for container orchestration
- ✅ Metrics middleware for request tracking
- ✅ Dockerfile for containerized deployment

### Metrics Instrumentation

- ✅ HTTP request counters with method, route, and status code labels
- ✅ Request duration histograms for latency percentiles
- ✅ Cache hit/miss counters
- ✅ Stellar simulation counters by network and success status
- ✅ Active simulations gauge

## 📊 Dashboard Preview

### Panels Overview

![Dashboard Overview](screenshots/dashboard-overview.png)

### Request Rate

![Request Rate](screenshots/request-rate.png)

### Latency Percentiles

![Latency Percentiles](screenshots/latency-percentiles.png)

### Prometheus Targets

![Prometheus Targets](screenshots/prometheus-targets.png)

## 🧪 Testing

### Manual Testing

```bash
# Start monitoring stack
docker-compose -f docker-compose.prod.yml up -d

# Generate test traffic
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"xdr":"test","network":"testnet"}'

# Access Grafana
open http://localhost:3001
```

### Verification Checklist

- [x] All Docker containers start successfully
- [x] Prometheus scrapes metrics from service
- [x] Grafana dashboard loads without errors
- [x] All 7 panels display data after test requests
- [x] Metrics endpoint returns valid Prometheus format
- [x] Health check endpoint returns 200 OK
- [x] Dashboard auto-refreshes every 30 seconds

## 📁 Files Changed

### New Files

- `monitoring/grafana-dashboard.json` - Main dashboard configuration
- `monitoring/grafana/dashboards/stellar-footprint-service.json` - Provisioned dashboard
- `monitoring/grafana/provisioning/datasources/prometheus.yml` - Prometheus data source
- `monitoring/grafana/provisioning/dashboards/dashboard.yml` - Dashboard provider config
- `monitoring/prometheus.yml` - Prometheus scrape configuration
- `monitoring/README.md` - Monitoring documentation
- `monitoring/SETUP.md` - Detailed setup guide
- `docker-compose.prod.yml` - Production Docker Compose configuration
- `Dockerfile` - Service container image
- `healthcheck.js` - Container health check script
- `src/middleware/metrics.ts` - Prometheus metrics implementation
- `.env.example` - Environment variables template
- `.dockerignore` - Docker build exclusions

### Modified Files

- `src/index.ts` - Added metrics middleware and endpoints
- `src/api/controllers.ts` - Added metrics tracking to simulation endpoint
- `package.json` - Added prom-client dependency

## 🔧 Configuration

### Environment Variables

```env
# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin

# Service
PORT=3000
TESTNET_RPC_URL=https://soroban-testnet.stellar.org
```

### Prometheus Metrics Exposed

```
http_requests_total{method, route, status_code}
http_request_duration_seconds_bucket{method, route}
cache_hits_total{cache_type}
cache_misses_total{cache_type}
stellar_simulations_total{network, success}
active_simulations
```

## 🚀 Deployment

### Quick Start

```bash
# Clone and setup
git checkout feature/grafana-dashboard
cp .env.example .env

# Install dependencies
pnpm install

# Start monitoring stack
docker-compose -f docker-compose.prod.yml up -d

# Access services
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
# Service: http://localhost:3000
```

### Production Considerations

- Change default Grafana password
- Enable HTTPS with reverse proxy
- Configure Prometheus retention policies
- Set up alerting rules
- Monitor resource usage

## 📚 Documentation

- [Monitoring README](monitoring/README.md) - Overview and configuration
- [Setup Guide](monitoring/SETUP.md) - Step-by-step installation
- [Dashboard JSON](monitoring/grafana-dashboard.json) - Importable dashboard

## 🔍 Metrics Details

### Request Rate

- **Query**: `rate(http_requests_total{job="stellar-footprint-service"}[5m])`
- **Purpose**: Monitor traffic patterns and detect anomalies

### Error Rate

- **Query**: `(rate(http_requests_total{status_code=~"4..|5.."}[5m]) / rate(http_requests_total[5m])) * 100`
- **Purpose**: Track service reliability
- **Thresholds**: Green < 1%, Yellow 1-5%, Red > 5%

### Latency Percentiles

- **P50**: `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))`
- **P95**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
- **P99**: `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))`
- **Purpose**: Monitor response time distribution
- **Target**: P95 < 500ms, P99 < 1000ms

### Cache Hit Rate

- **Query**: `(rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) * 100`
- **Purpose**: Optimize caching strategy
- **Target**: > 80% hit rate

## 🐛 Known Issues

None at this time.

## 🔄 Breaking Changes

None. This is a purely additive feature.

## 📝 Checklist

- [x] Code follows project style guidelines
- [x] Documentation updated
- [x] All tests pass
- [x] Dashboard tested with real traffic
- [x] Screenshots included
- [x] Environment variables documented
- [x] Docker Compose configuration tested
- [x] Metrics endpoint verified
- [x] Health check endpoint verified

## 🤝 Reviewers

Please verify:

1. Dashboard loads correctly in Grafana
2. All panels display data after test requests
3. Prometheus successfully scrapes metrics
4. Documentation is clear and complete
5. Docker Compose setup works as expected

## 📞 Questions?

Feel free to comment on this PR or reach out on Discord.

---

**Ready for review! 🚀**
