from __future__ import annotations

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


ensure_openai_key_from_secrets_manager()
settings = load_settings()
store = TaskStore(settings.redis_url)

app = FastAPI(title="glazyr-control", version="0.1")


@app.middleware("http")
async def policy_middleware(request: Request, call_next):
    # Only enforce strict checks on invoke route(s) and monitoring routes if desired.
    path = request.url.path or ""

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
            return JSONResponse(status_code=e.status_code, content={"error": str(e.detail)})

    return await call_next(request)


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

    res = mcp_invoke(payload, store=store, model=settings.openai_model)
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

