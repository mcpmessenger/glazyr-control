# Observability Architecture: Extension vs Backend

## Quick Answer

**Extension Observability**: ❌ Not needed right now
- Extension makes HTTP requests → Backend (glazyr-control)
- Backend logs/telemetry captures those requests
- Extension doesn't need Prometheus/Sentry directly

**Working Directory**: ✅ We can work from root (which we've been doing)
- Files go in appropriate subdirectories (`glazyr-control/`, `glazyr-extension/`)
- Root-level docs are fine (like `OBSERVABILITY_EXPLAINED.md`)

## Current Architecture

```
┌─────────────────┐         HTTP Requests        ┌──────────────────┐
│  Extension      │ ────────────────────────────> │  glazyr-control  │
│  (Browser)      │                               │  (Backend)       │
│                 │ <──────────────────────────── │                  │
│  - User actions │     HTTP Responses           │  - Logs          │
│  - UI events    │                               │  - Telemetry     │
└─────────────────┘                               │  - Metrics       │
                                                  └──────────────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │  Observability   │
                                                  │  (Prometheus/    │
                                                  │   Grafana/       │
                                                  │   Sentry)        │
                                                  └──────────────────┐
```

## Extension → Backend Communication

The extension **calls** the backend, not the other way around:

```javascript
// Extension (background.js) makes requests:
fetch('https://your-glazyr-control.com/mcp/invoke', {
  method: 'POST',
  body: JSON.stringify({
    tool: 'agent_executor',
    input: { input: 'Find coffee shops' }
  })
})
```

When this request hits the backend, **the backend's telemetry automatically captures it**:
- Request ID is generated
- Execution time is tracked
- Errors are logged
- Metrics are collected

## Do We Need Extension-Side Observability?

### Current Setup (Recommended): ✅ Backend Only

**Pros:**
- Simpler architecture
- All observability in one place
- Easier to manage and query
- Backend sees the full picture (all extensions)

**Cons:**
- Can't see extension-side errors (network failures, parsing errors)
- Can't track extension performance separately

### If You Want Extension Observability (Optional)

You could add client-side telemetry to the extension:

```typescript
// In extension (optional, not implemented yet)
async function sendTelemetry(event: {
  type: string;
  duration_ms?: number;
  error?: string;
}) {
  // Send to backend's telemetry endpoint
  fetch('https://your-backend.com/api/telemetry', {
    method: 'POST',
    body: JSON.stringify(event)
  });
}
```

**When you'd need this:**
- Tracking extension crashes
- Measuring extension startup time
- Debugging extension-specific issues
- A/B testing extension features

**For now: Backend-only is sufficient!** ✅

## Where Observability Lives

### Backend (glazyr-control) ✅ **IMPLEMENTED**

**Location:** `glazyr-control/src/telemetry.py`

**What it tracks:**
- All HTTP requests (from extension and anywhere)
- Tool executions (google_places_search, etc.)
- Agent execution times
- Errors and failures
- Request IDs for tracing

**Ready for:**
- Prometheus metrics export
- Sentry error tracking
- Structured logging

### Extension ❌ **NOT NEEDED (for now)**

**What it currently does:**
- Makes HTTP requests to backend
- Handles user interactions
- Shows approval UI

**What it doesn't need:**
- Prometheus client
- Sentry SDK
- Metrics collection

**If you add it later:**
- Could track extension performance
- Could report client-side errors
- Would send to backend's telemetry endpoint

## Working Directory Question

### Can We Work From Root? ✅ YES

I've been creating files in the appropriate subdirectories:

**Backend files:**
- `glazyr-control/src/telemetry.py` ✅
- `glazyr-control/src/tracing.py` ✅
- `glazyr-control/src/connectors/` ✅

**Extension files:**
- `glazyr-extension/src/approval-ui/` ✅
- `glazyr-extension/src/connectors/` ✅

**Documentation (root is fine):**
- `OBSERVABILITY_EXPLAINED.md` ✅ (root-level doc)
- `TELEMETRY_GUIDE.md` ✅ (root-level doc)
- `QUICK_START.md` ✅ (root-level doc)

### When to Update Subdirectories

You should update files in their respective subdirectories when:
- Making changes to existing code
- Adding features to specific components
- The files need to be in that location to work

**Example:**
- ✅ `glazyr-control/src/telemetry.py` (needs to be in Python path)
- ✅ `glazyr-extension/src/approval-ui/approval-manager.ts` (needs to be in extension src)

**Root-level docs are fine:**
- ✅ `OBSERVABILITY_EXPLAINED.md` (just documentation)
- ✅ `IMPLEMENTATION_STATUS.md` (project-wide status)

## Recommended Setup

### For Production (Backend Observability)

1. **Add Prometheus metrics export** to glazyr-control:
   ```python
   # glazyr-control/src/main.py
   from prometheus_client import make_asgi_app
   metrics_app = make_asgi_app()
   app.mount("/metrics", metrics_app)
   ```

2. **Add Sentry** to glazyr-control:
   ```python
   # glazyr-control/src/main.py
   import sentry_sdk
   sentry_sdk.init(dsn="your-sentry-dsn")
   ```

3. **Configure Grafana** to scrape `/metrics` endpoint

4. **Extension doesn't need changes** - it already calls the backend

### Extension-Side (Optional, Future)

If you want extension observability later:

1. Create telemetry helper in extension
2. Send events to backend's `/api/telemetry` endpoint
3. Backend aggregates extension + backend metrics

## Summary

| Component | Observability Needed? | Status |
|-----------|----------------------|--------|
| **glazyr-control (Backend)** | ✅ YES | ✅ Implemented |
| **Extension** | ❌ No (for now) | ⏳ Optional future |
| **glazyr-main (Website)** | ❌ No | ⏳ Optional future |

**Key Point:** Extension makes requests → Backend logs everything → Observability on backend captures it all!

## Next Steps

1. ✅ **Backend telemetry is ready** - just needs Prometheus/Sentry integration
2. ❌ **Extension doesn't need observability** - backend handles it
3. ✅ **Continue working from root** - files go in appropriate subdirectories

The architecture is correct as-is! 🎉
