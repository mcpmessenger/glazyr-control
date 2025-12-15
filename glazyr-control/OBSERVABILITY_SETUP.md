# Observability Setup Guide

This guide explains how to configure Prometheus and Sentry for glazyr-control.

## Quick Start

### Prometheus (Metrics)

Prometheus metrics are **enabled by default**. They're available at:

```
GET http://localhost:8000/metrics
```

### Sentry (Error Tracking)

Sentry is **disabled by default**. To enable:

```bash
export SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
export SENTRY_ENABLED="true"
```

## Configuration

### Environment Variables

```bash
# Prometheus (enabled by default)
PROMETHEUS_ENABLED=true  # Set to "false" to disable

# Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENABLED=false  # Set to "true" to enable
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions traced (0.0 to 1.0)
SENTRY_ENVIRONMENT=production  # Environment name (production, staging, development)
SENTRY_RELEASE=1.0.0  # Release version (optional)
```

### Prometheus Metrics

The following metrics are automatically exported:

#### Counters

- `tool_calls_total{tool, status}` - Total tool calls by tool name and status
- `connector_executions_total{connector, status}` - Total connector executions
- `agent_executions_total{status}` - Total agent executions

#### Histograms (Duration)

- `tool_duration_seconds{tool}` - Tool execution duration
- `connector_duration_seconds{connector}` - Connector execution duration
- `agent_duration_seconds` - Agent execution duration

### Example Metrics Output

```
# HELP tool_calls_total Total number of tool calls
# TYPE tool_calls_total counter
tool_calls_total{status="success",tool="google_places_search"} 150.0
tool_calls_total{status="error",tool="google_places_search"} 3.0

# HELP tool_duration_seconds Tool execution duration in seconds
# TYPE tool_duration_seconds histogram
tool_duration_seconds_bucket{tool="google_places_search",le="0.01"} 0.0
tool_duration_seconds_bucket{tool="google_places_search",le="0.05"} 5.0
tool_duration_seconds_bucket{tool="google_places_search",le="0.1"} 45.0
tool_duration_seconds_bucket{tool="google_places_search",le="0.5"} 145.0
tool_duration_seconds_bucket{tool="google_places_search",le="+Inf"} 150.0
tool_duration_seconds_sum{tool="google_places_search"} 35.123
tool_duration_seconds_count{tool="google_places_search"} 150.0
```

## Setting Up Prometheus

### 1. Install Prometheus

```bash
# macOS
brew install prometheus

# Linux (Ubuntu/Debian)
sudo apt-get install prometheus

# Or download from https://prometheus.io/download/
```

### 2. Configure Prometheus

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'glazyr-control'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
```

### 3. Start Prometheus

```bash
prometheus --config.file=prometheus.yml
```

Access Prometheus UI at: http://localhost:9090

### 4. Example Queries

```promql
# Tool call rate (calls per second)
rate(tool_calls_total[5m])

# Error rate for Google Places tool
rate(tool_calls_total{tool="google_places_search",status="error"}[5m])

# 95th percentile latency for tools
histogram_quantile(0.95, tool_duration_seconds_bucket)

# Total errors in last hour
sum(increase(tool_calls_total{status="error"}[1h]))
```

## Setting Up Grafana

### 1. Install Grafana

```bash
# macOS
brew install grafana

# Linux (Ubuntu/Debian)
sudo apt-get install grafana

# Or download from https://grafana.com/grafana/download
```

### 2. Start Grafana

```bash
grafana-server
```

Access Grafana UI at: http://localhost:3000 (default login: admin/admin)

### 3. Add Prometheus Data Source

1. Go to Configuration → Data Sources
2. Add Prometheus
3. URL: `http://localhost:9090`
4. Save & Test

### 4. Create Dashboard

Create a new dashboard with panels:

**Panel 1: Tool Call Rate**
- Query: `rate(tool_calls_total[5m])`
- Visualization: Graph

**Panel 2: Error Rate**
- Query: `rate(tool_calls_total{status="error"}[5m])`
- Visualization: Graph

**Panel 3: Tool Latency (95th percentile)**
- Query: `histogram_quantile(0.95, tool_duration_seconds_bucket)`
- Visualization: Graph

**Panel 4: Current Error Count**
- Query: `sum(tool_calls_total{status="error"})`
- Visualization: Stat

## Setting Up Sentry

### 1. Create Sentry Account

1. Go to https://sentry.io/signup/
2. Create a new project (Python/FastAPI)
3. Copy your DSN

### 2. Configure Environment Variables

```bash
export SENTRY_DSN="https://your-key@sentry.io/project-id"
export SENTRY_ENABLED="true"
export SENTRY_ENVIRONMENT="production"
export SENTRY_RELEASE="1.0.0"
```

### 3. Test Error Capture

Errors are automatically captured when:
- Exceptions are raised in request handlers
- Telemetry events have `status="error"`
- Agent execution fails

### 4. Sentry Features

- **Error grouping**: Similar errors are grouped together
- **Stack traces**: Full stack traces with file/line numbers
- **Context**: Request IDs, tool names, connector names
- **Alerts**: Configure email/Slack alerts for error spikes
- **Releases**: Track which version introduced errors

## Docker Compose (All-in-One)

Create `docker-compose.observability.yml`:

```yaml
version: '3.8'

services:
  glazyr-control:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PROMETHEUS_ENABLED=true
      - SENTRY_DSN=${SENTRY_DSN}
      - SENTRY_ENABLED=${SENTRY_ENABLED}

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

Start with:
```bash
docker-compose -f docker-compose.observability.yml up
```

## Production Deployment

### AWS Lambda (SAM)

When deploying to AWS Lambda:

1. **Prometheus**: Use CloudWatch metrics instead (native AWS integration)
2. **Sentry**: Works in Lambda, just set environment variables

### CloudWatch Metrics

For AWS deployments, consider using CloudWatch instead of Prometheus:

```python
import boto3
cloudwatch = boto3.client('cloudwatch')

cloudwatch.put_metric_data(
    Namespace='Glazyr/Control',
    MetricData=[{
        'MetricName': 'ToolCalls',
        'Value': 1,
        'Dimensions': [
            {'Name': 'Tool', 'Value': 'google_places_search'},
            {'Name': 'Status', 'Value': 'success'}
        ]
    }]
)
```

## Troubleshooting

### Prometheus metrics not showing

1. Check `/metrics` endpoint is accessible
2. Verify `PROMETHEUS_ENABLED=true` (default)
3. Check Prometheus can reach your server

### Sentry not capturing errors

1. Verify `SENTRY_DSN` is set correctly
2. Check `SENTRY_ENABLED=true`
3. Look for Sentry SDK initialization errors in logs
4. Test with a deliberate error: raise Exception("test")

### High cardinality warnings

If you see warnings about high cardinality:
- Reduce number of labels on metrics
- Aggregate metrics at application level
- Use histograms instead of many counters

## Security Considerations

- **Metrics endpoint**: Consider adding authentication for `/metrics` in production
- **Sentry DSN**: Keep DSN secret, use environment variables
- **PII**: Telemetry automatically redacts sensitive data (API keys, passwords)

## Next Steps

1. Set up Prometheus + Grafana locally
2. Create dashboards for your key metrics
3. Configure Sentry alerts for critical errors
4. Set up production monitoring
5. Create runbooks for common issues
