from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .config import load_settings
from .mcp import invoke as mcp_invoke
from .mcp import mcp_manifest
from .policy import extract_api_key, read_body_with_replay, validate_allowlist
from .secrets import ensure_openai_key_from_secrets_manager
from .state import TaskStore

# Initialize Sentry if enabled
settings = load_settings()
app = FastAPI(title="glazyr-control", version="0.1")

if settings.sentry_enabled and settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[
                FastApiIntegration(),
                LoggingIntegration(level=None, event_level=None),
            ],
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
            release=os.getenv("SENTRY_RELEASE"),
        )
    except ImportError:
        # Sentry not installed, skip
        pass

# Initialize Prometheus metrics if enabled
REQUESTS_TOTAL = None
REQUEST_LATENCY = None
if settings.prometheus_enabled:
    try:
        from fastapi.responses import Response
        from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

        # Basic HTTP metrics (low-cardinality labels: method + path template-like usage).
        REQUESTS_TOTAL = Counter(
            "glazyr_http_requests_total",
            "Total HTTP requests handled by glazyr-control.",
            ["method", "path", "status"],
        )
        REQUEST_LATENCY = Histogram(
            "glazyr_http_request_duration_seconds",
            "HTTP request latency in seconds for glazyr-control.",
            ["method", "path"],
            buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
        )

        @app.get("/metrics")
        async def metrics():
            # Avoid redirect loops with Function URL + mounted ASGI apps.
            return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except ImportError:
        pass
else:
    pass

ensure_openai_key_from_secrets_manager()
store = TaskStore(settings.redis_url)


@app.middleware("http")
async def policy_middleware(request: Request, call_next):
    # Only enforce strict checks on invoke route(s) and monitoring routes if desired.
    path = request.url.path or ""
    method = request.method or "GET"
    start = time.perf_counter()

    # Read and replay body once for downstream handlers.
    raw_body, parsed_json = await read_body_with_replay(request)

    # Payload size limit (default 5MB)
    if settings.payload_max_bytes > 0 and raw_body and len(raw_body) > settings.payload_max_bytes:
        return JSONResponse(status_code=413, content={"error": "Payload too large"})

    # Optional auth
    if settings.api_key:
        provided = extract_api_key(dict(request.headers))
        # Only require auth for invoke + monitoring (safe but still operationally sensitive)
        if path.startswith("/mcp/") or path.startswith("/api/"):
            if not provided or provided != settings.api_key:
                return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    # Optional allowlist (only meaningful if payload contains URLs)
    if settings.allowed_domains and path == "/mcp/invoke":
        try:
            validate_allowlist(parsed_json, settings.allowed_domains)
        except HTTPException as e:
            # Record metrics before returning early.
            if REQUESTS_TOTAL is not None:
                REQUESTS_TOTAL.labels(method=method, path=path, status=str(e.status_code)).inc()
            if REQUEST_LATENCY is not None:
                REQUEST_LATENCY.labels(method=method, path=path).observe(max(0.0, time.perf_counter() - start))
            return JSONResponse(status_code=e.status_code, content={"error": str(e.detail)})

    try:
        response = await call_next(request)
    except Exception:
        # Ensure we still increment metrics on unhandled errors.
        if REQUESTS_TOTAL is not None:
            REQUESTS_TOTAL.labels(method=method, path=path, status="500").inc()
        if REQUEST_LATENCY is not None:
            REQUEST_LATENCY.labels(method=method, path=path).observe(max(0.0, time.perf_counter() - start))
        raise

    if REQUESTS_TOTAL is not None:
        REQUESTS_TOTAL.labels(method=method, path=path, status=str(getattr(response, "status_code", 200))).inc()
    if REQUEST_LATENCY is not None:
        REQUEST_LATENCY.labels(method=method, path=path).observe(max(0.0, time.perf_counter() - start))

    return response


@app.get("/healthz")
async def healthz():
    return {"ok": True, "ts": int(time.time() * 1000)}


@app.get("/mcp/manifest")
async def get_manifest():
    return mcp_manifest()


@app.post("/mcp/invoke")
async def post_invoke(request: Request):
    payload: Any = None
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    res = mcp_invoke(payload, store=store, model=settings.openai_model, settings=settings)
    # Standardize errors as MCP-shaped responses (no stack traces).
    if isinstance(res, dict) and res.get("error"):
        # Keep 200 for MCP compatibility; clients should inspect "error".
        return res
    return res


@app.get("/api/tasks")
async def list_tasks(limit: int = 50):
    tasks = store.list(limit=limit)
    return {"tasks": [t.__dict__ for t in tasks]}


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    s = store.get(task_id)
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return {"task": s.__dict__}

