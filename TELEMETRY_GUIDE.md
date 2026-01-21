# Telemetry and Logging Guide

This guide explains the telemetry and logging infrastructure in Glazyr.

## Overview

Glazyr uses structured logging and telemetry to track:
- Request IDs for distributed tracing
- Tool execution metrics
- Connector performance
- Agent execution flows
- Error tracking

## Structured Logging

All logs are emitted as JSON for easy parsing and aggregation.

### Example Log Output

```json
{
  "timestamp": "2025-01-14 10:30:45,123",
  "level": "INFO",
  "logger": "glazyr",
  "message": "Telemetry: tool_call",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "tool": "google_places_search",
  "status": "success",
  "duration_ms": 234.5
}
```

## Request ID Tracking

Every request is assigned a unique request ID that flows through the entire execution chain.

### Automatic Request ID Generation

Request IDs are automatically generated and tracked using context variables:

```python
from src.tracing import RequestContext, get_request_id

# Automatically generates request ID
with RequestContext():
    # All code here has access to the request ID
    request_id = get_request_id()
    # ... execute code ...
```

### Manual Request ID Setting

You can also provide your own request ID:

```python
with RequestContext(request_id="my-custom-id"):
    # Use the provided request ID
    pass
```

## Telemetry Events

### Tool Call Events

```python
from src.telemetry import log_tool_call

log_tool_call(
    tool="google_places_search",
    request_id="...",
    status="success",
    duration_ms=234.5,
    metadata={"limit": 5}
)
```

### Connector Execution Events

```python
from src.telemetry import log_connector_execution

log_connector_execution(
    connector="google_places",
    request_id="...",
    status="success",
    duration_ms=234.5
)
```

### Agent Execution Events

```python
from src.telemetry import log_agent_execution

log_agent_execution(
    request_id="...",
    status="success",
    duration_ms=1234.5,
    tool_calls=2
)
```

## Context Manager for Automatic Tracking

Use the `track_execution` context manager for automatic timing and error tracking:

```python
from src.telemetry import track_execution

with track_execution(
    event_type="tool_call",
    request_id=request_id,
    tool="google_places_search"
):
    result = tool.execute(...)
    # Automatically logs success/error with timing
```

## Metrics Collection

The telemetry collector maintains metrics that can be exported:

```python
from src.telemetry import get_telemetry_collector

collector = get_telemetry_collector()
metrics = collector.get_metrics()

# Returns:
# {
#   "tool_call": {
#     "count": 150,
#     "errors": 3,
#     "total_duration_ms": 35000.0
#   },
#   ...
# }
```

## Sensitive Data Redaction

Use the redaction helper to remove sensitive data before logging:

```python
from src.telemetry import redact_sensitive_data

data = {
    "query": "coffee shops",
    "api_key": "secret123",
    "password": "mypassword"
}

safe_data = redact_sensitive_data(data)
# "api_key" and "password" will be redacted
```

## Integration Points

### In FastAPI Middleware

Request IDs are automatically tracked in MCP endpoints:

```python
# In mcp.py, RequestContext is used automatically
def invoke(payload, *, store, model):
    request_id = inputs.get("request_id") or str(uuid.uuid4())
    with RequestContext(request_id):
        # All downstream code has access to request_id
        ...
```

### In Connectors

Connectors automatically log execution metrics:

```python
# In google_places.py
start_time = time.time()
result = bridge.search(...)
duration_ms = (time.time() - start_time) * 1000
log_connector_execution(...)
```

### In Agent

Agent tracks overall execution and tool usage:

```python
# In agent.py
log_agent_execution(
    request_id=request_id,
    status="success",
    duration_ms=duration_ms,
    tool_calls=tool_calls_count
)
```

## Future Integrations

### Prometheus Metrics

To integrate with Prometheus, add a metrics exporter:

```python
from prometheus_client import Counter, Histogram

tool_calls_total = Counter('tool_calls_total', 'Total tool calls', ['tool', 'status'])
tool_duration = Histogram('tool_duration_seconds', 'Tool execution time', ['tool'])
```

### Sentry Integration

To integrate with Sentry for error tracking:

```python
import sentry_sdk

sentry_sdk.init(...)

# Errors are automatically captured from telemetry events
log_tool_call(..., status="error", error="...")
```

### CloudWatch/DataDog

Structured JSON logs can be directly ingested by CloudWatch Logs Insights or DataDog.

## Configuration

Set log level via environment variable:

```bash
export GLAZYR_LOG_LEVEL=DEBUG  # DEBUG, INFO, WARNING, ERROR
```

Or in code:

```python
import logging
logging.getLogger("glazyr").setLevel(logging.DEBUG)
```

## Testing

Telemetry can be tested by checking the collector:

```python
from src.telemetry import get_telemetry_collector

collector = get_telemetry_collector()
collector.clear()  # Clear for testing

# ... execute code ...

events = collector.events
assert len(events) > 0
assert events[0].event_type == "tool_call"
```
