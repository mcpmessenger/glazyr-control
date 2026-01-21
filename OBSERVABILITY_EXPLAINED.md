# Observability Explained

## What is Observability?

**Observability** is the ability to understand what's happening inside your system by looking at its outputs (logs, metrics, traces). Think of it as "visibility" into your application.

Instead of waiting for users to report problems, observability lets you:
- **See problems before users do** (e.g., "API calls are taking 5 seconds")
- **Debug issues quickly** (e.g., "This error only happens for requests with request_id X")
- **Understand system health** (e.g., "We're getting 1000 requests/minute, 99% succeed")
- **Plan capacity** (e.g., "Usage is growing, we'll need more servers in 2 months")

## The Three Pillars of Observability

### 1. **Logs** (What happened)
- Text records of events
- Example: "User clicked button at 10:30 AM"
- What we have: Structured JSON logs in Glazyr

### 2. **Metrics** (How often/how much)
- Numerical measurements over time
- Example: "100 API calls in the last minute"
- What we have: Telemetry collector tracking counts, durations

### 3. **Traces** (How requests flow through the system)
- Following a request from start to finish
- Example: "Request X went: Agent → Tool → Connector → API (took 234ms)"
- What we have: Request IDs that link events together

## What Are These Tools?

### Prometheus + Grafana

**Prometheus** = Metrics Database
- Stores numbers (counters, timers, etc.)
- Example metrics:
  - `tool_calls_total{tool="google_places_search",status="success"}` = 150
  - `tool_duration_seconds{tool="google_places_search"}` = 0.234 (average)
- **Query language** to ask questions: "How many tool calls failed in the last hour?"

**Grafana** = Visualization Dashboard
- Creates charts/graphs from Prometheus data
- Example dashboards:
  - Line chart: "Tool call rate over time"
  - Gauge: "Current error rate: 2%"
  - Table: "Top 5 slowest tools"
- **Visual** way to see your system health

**Together**: Prometheus collects metrics, Grafana displays them in pretty dashboards.

### Sentry

**Sentry** = Error Tracking Service
- Catches errors automatically
- Sends you alerts when errors happen
- Groups similar errors together
- Shows you the exact code line that failed
- **Example alert**: "15 new errors in the last 5 minutes: 'API key not found'"

## Why Do We Need This?

Currently, Glazyr logs to the console (stdout). This is fine for development, but in production you need:

### Current State (Without Observability)
```
❌ Logs only exist while server is running
❌ Hard to find specific errors
❌ Can't see trends (is error rate increasing?)
❌ No alerts when things break
❌ Can't answer: "Why was this request slow?"
```

### With Observability (Prometheus/Grafana/Sentry)
```
✅ All logs stored permanently
✅ Search/filter logs by request_id
✅ See error rates on a graph
✅ Get Slack/email alerts when errors spike
✅ Trace slow requests end-to-end
✅ Answer: "Request ABC took 5 seconds because connector X was slow"
```

## How It Would Work in Glazyr

### Example: Monitoring Tool Calls

**Without Observability:**
```bash
# You see logs scrolling in terminal
{"tool": "google_places_search", "status": "success", "duration_ms": 234}
{"tool": "google_places_search", "status": "error", "error": "API key invalid"}
# Hard to see patterns
```

**With Prometheus/Grafana:**
1. Metrics collected:
   ```
   tool_calls_total{tool="google_places_search",status="success"} = 150
   tool_calls_total{tool="google_places_search",status="error"} = 3
   tool_duration_seconds{tool="google_places_search"} = 0.234
   ```

2. Grafana dashboard shows:
   - **Chart**: "Tool calls per minute" (line going up = more usage)
   - **Gauge**: "Error rate: 2%" (red if > 5%)
   - **Table**: "Average duration: 234ms" (highlights slow tools)

3. **Alert** if error rate > 5%: "Alert: Google Places tool error rate is 8%!"

### Example: Error Tracking with Sentry

**Without Sentry:**
```bash
# Error logged but you might miss it
{"status": "error", "error": "API key not found"}
# No notification, might not see it for hours
```

**With Sentry:**
1. Error automatically sent to Sentry
2. **Sentry dashboard** shows:
   - "15 occurrences of 'API key not found'"
   - Stack trace pointing to `secrets.py:line 45`
   - Affected users/requests
3. **Alert sent** to your Slack/email
4. You fix it immediately

## Practical Example: Debugging a Slow Request

**Scenario**: User reports "Search took 10 seconds"

**Without Observability:**
- Hard to find the specific request
- Can't see what took so long
- Guess: "Maybe the API was slow?"

**With Observability:**
1. **Find request**: Search logs for request_id from user
2. **Trace shows**:
   ```
   Request ABC123 timeline:
   10:30:00.000 - Agent started
   10:30:00.500 - Tool called (google_places_search)
   10:30:02.000 - Connector started
   10:30:09.500 - API responded (7.5 seconds!)
   10:30:09.750 - Response returned to user
   ```
3. **Identify problem**: "Google Places API took 7.5 seconds"
4. **Fix**: Add caching or rate limiting

## Integration Steps (Simplified)

### Step 1: Export Metrics to Prometheus

```python
# In glazyr-control/src/telemetry.py
from prometheus_client import Counter, Histogram

# Define metrics
tool_calls_total = Counter('tool_calls_total', 'Total tool calls', ['tool', 'status'])
tool_duration = Histogram('tool_duration_seconds', 'Tool execution time', ['tool'])

# When tool executes:
tool_calls_total.labels(tool='google_places_search', status='success').inc()
tool_duration.labels(tool='google_places_search').observe(0.234)
```

### Step 2: Expose Metrics Endpoint

```python
# In glazyr-control/src/main.py
from prometheus_client import make_asgi_app

# Add metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

### Step 3: Configure Grafana

1. Point Grafana to Prometheus
2. Create dashboard with queries like:
   ```
   rate(tool_calls_total[5m])  # Calls per second
   ```
3. Add alerts: "Error rate > 5%"

### Step 4: Add Sentry

```python
import sentry_sdk
sentry_sdk.init(dsn="https://your-sentry-dsn")

# Errors automatically captured
try:
    result = tool.execute()
except Exception as e:
    # Sentry captures this automatically
    raise
```

## Do You Need This Now?

**For Development**: ❌ Not critical
- Console logs are fine
- You can see errors immediately

**For Production**: ✅ Highly recommended
- Need to monitor system health
- Can't be watching logs 24/7
- Need alerts when things break
- Need historical data to debug issues

## Quick Start (If You Want to Try It)

### Option 1: Local Testing with Docker

```bash
# Start Prometheus + Grafana
docker run -d -p 9090:9090 prom/prometheus
docker run -d -p 3000:3000 grafana/grafana

# Point Prometheus to your app's /metrics endpoint
# Access Grafana at http://localhost:3000
```

### Option 2: Cloud Services (Easier)

- **Sentry**: Free tier, 5 minutes to set up
  - Sign up at sentry.io
  - Install Python SDK
  - Done! Errors automatically tracked

- **Datadog/New Relic**: All-in-one (logs + metrics + traces)
  - Usually costs money
  - Very easy to set up

## Summary

**Observability** = Being able to see what's happening in your system

**Prometheus** = Stores metrics (numbers about your system)

**Grafana** = Shows metrics in pretty charts

**Sentry** = Tracks errors and alerts you

**You need this** when running in production to:
- Monitor system health
- Debug issues quickly
- Get alerts when things break
- Understand usage patterns

**You don't need this** for:
- Local development
- Simple projects
- Learning/experimenting

The telemetry infrastructure we built is ready to connect to these tools when you need them!
