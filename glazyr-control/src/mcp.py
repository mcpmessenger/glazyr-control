from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException
from tenacity import RetryError

from .agent import AgentError, execute_agent
from .policy import safe_text_preview, sha256_hex
from .state import TaskStore, TaskSummary
from .tracing import RequestContext, get_request_id, set_request_id
from .telemetry import log_tool_call, log_agent_execution

_MCP_INVOCATIONS = None
if os.getenv("PROMETHEUS_ENABLED", "").lower() in ("1", "true", "yes"):
    try:
        from prometheus_client import Counter

        _MCP_INVOCATIONS = Counter(
            "glazyr_mcp_invocations_total",
            "Total MCP tool invocations handled by glazyr-control.",
            ["tool"],
        )
    except Exception:
        _MCP_INVOCATIONS = None


def mcp_manifest() -> Dict[str, Any]:
    # Small, stable manifest. Keep it backward-compatible.
    return {
        "protocol": "mcp",
        "version": "0.1",
        "tools": [
            {
                "name": "agent_executor",
                "description": "Run the Glazyr-Control agent to reason/orchestrate and return a textual result.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "input": {"type": "string", "description": "User query / instruction (may include screenshot refs)."},
                        "task_id": {
                            "type": "string",
                            "description": "Optional client-provided task id for resumable workflows.",
                        },
                    },
                    "required": ["input"],
                    "additionalProperties": True,
                },
            },
            {
                "name": "google_places_search",
                "description": "Search for places (restaurants, businesses, points of interest) using Google Places API.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (e.g., 'vegan restaurants near me')",
                        },
                        "location": {
                            "type": "object",
                            "description": "Optional location dict with 'lat' and 'lng' keys",
                            "properties": {
                                "lat": {"type": "number"},
                                "lng": {"type": "number"},
                            },
                        },
                        "radius_meters": {
                            "type": "integer",
                            "description": "Search radius in meters (default 2000)",
                            "default": 2000,
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results to return (default 5)",
                            "default": 5,
                        },
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            },
        ],
    }


def _normalize_invoke_request(payload: Any) -> Tuple[str, Dict[str, Any]]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    tool = payload.get("tool") or payload.get("name") or payload.get("tool_name") or payload.get("method") or ""
    tool = str(tool or "").strip()
    inputs = payload.get("inputs") or payload.get("arguments") or payload.get("params") or payload.get("input") or {}

    # Some callers send { tool: "...", input: {...}}; normalize.
    if isinstance(inputs, str):
        inputs = {"input": inputs}
    if not isinstance(inputs, dict):
        inputs = {"input": str(inputs)}
    return tool, inputs


def _get_task_id(inputs: Dict[str, Any]) -> str:
    tid = inputs.get("task_id") or inputs.get("taskId") or inputs.get("id") or ""
    tid = str(tid or "").strip()
    return tid if tid else str(uuid.uuid4())


def invoke(payload: Any, *, store: TaskStore, model: str) -> Dict[str, Any]:
    tool, inputs = _normalize_invoke_request(payload)
    if not tool:
        raise HTTPException(status_code=400, detail="Missing tool name")

    if _MCP_INVOCATIONS is not None:
        # Keep cardinality bounded (tool names are from a small allowlist).
        _MCP_INVOCATIONS.labels(tool=tool).inc()
    
    # Set up request context for tracing
    request_id = inputs.get("request_id") or str(uuid.uuid4())
    with RequestContext(request_id):
        # Handle google_places_search tool directly
        if tool == "google_places_search":
            return _invoke_google_places_search(inputs)
        
        # Handle agent_executor (existing logic)
        if tool != "agent_executor":
            raise HTTPException(status_code=404, detail=f"Unknown tool: {tool}")

        task_id = _get_task_id(inputs)
        input_query = inputs.get("input") or inputs.get("query") or inputs.get("prompt") or ""
        input_query = str(input_query or "").strip()
        if not input_query:
            raise HTTPException(status_code=422, detail="Missing inputs.input")

        now = int(time.time() * 1000)
    # Write a pending summary early (so polling sees activity).
    store.upsert(
        TaskSummary(
            task_id=task_id,
            status="running",
            updated_at_ms=now,
            input_preview=safe_text_preview(input_query, 800),
            output_preview="",
            output_sha256="",
        )
    )

    start_time = time.time()
    try:
        result = execute_agent(input_query, model=model, task_id=task_id)
        out = str(result.get("output") or "").strip()
        out_preview = safe_text_preview(out, 1200)
        out_hash = sha256_hex(out)
        duration_ms = (time.time() - start_time) * 1000
        
        # Log telemetry
        tool_calls_count = result.get("tool_calls_count", 0)
        log_agent_execution(
            request_id=request_id,
            status="success",
            duration_ms=duration_ms,
            tool_calls=tool_calls_count,
        )
        
        store.upsert(
            TaskSummary(
                task_id=task_id,
                status="completed",
                updated_at_ms=int(time.time() * 1000),
                input_preview=safe_text_preview(input_query, 800),
                output_preview=out_preview,
                output_sha256=out_hash,
            )
        )
        # MCP-ish response shape (backward compatible): include both "output" and "result".
        return {"task_id": task_id, "output": out, "result": out, "request_id": request_id}
    except AgentError as e:
        msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        
        # Log telemetry
        log_agent_execution(
            request_id=request_id,
            status="error",
            duration_ms=duration_ms,
            error=msg,
        )
        
        store.upsert(
            TaskSummary(
                task_id=task_id,
                status="failed",
                updated_at_ms=int(time.time() * 1000),
                input_preview=safe_text_preview(input_query, 800),
                output_preview="",
                output_sha256="",
                error=safe_text_preview(msg, 800),
            )
        )
        return {"task_id": task_id, "error": msg, "request_id": request_id}
    except Exception as e:
        # If tenacity gave up, surface the underlying exception message.
        if isinstance(e, RetryError):
            try:
                last = e.last_attempt.exception()
                if last is not None:
                    e = last
            except Exception:
                pass
        msg = str(e)
        duration_ms = (time.time() - start_time) * 1000
        
        # Log telemetry
        log_agent_execution(
            request_id=request_id,
            status="error",
            duration_ms=duration_ms,
            error=msg,
        )
        
        store.upsert(
            TaskSummary(
                task_id=task_id,
                status="failed",
                updated_at_ms=int(time.time() * 1000),
                input_preview=safe_text_preview(input_query, 800),
                output_preview="",
                output_sha256="",
                error=safe_text_preview(msg, 800),
            )
        )
        return {"task_id": task_id, "error": "Internal error", "details": safe_text_preview(msg, 800), "request_id": request_id}


def _invoke_google_places_search(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Handle google_places_search tool invocation."""
    from .errors import ValidationError, ToolError, format_error_response
    from .telemetry import track_execution, log_tool_call

    request_id = get_request_id() or inputs.get("request_id") or str(uuid.uuid4())
    start_time = time.time()

    try:
        from .connectors.google_places import get_google_places_bridge

        query = inputs.get("query", "").strip()
        if not query:
            error = ValidationError("Missing required parameter: query", field="query", request_id=request_id)
            log_tool_call("google_places_search", request_id, "error", error="Missing query")
            return error.to_dict()

        location = inputs.get("location")
        radius_meters = inputs.get("radius_meters", 2000)
        limit = inputs.get("limit", 5)
        request_id = inputs.get("request_id") or str(uuid.uuid4())

        # Validate location format if provided
        if location is not None:
            if not isinstance(location, dict):
                error = ValidationError(
                    "Location must be a dict with 'lat' and 'lng' keys",
                    field="location",
                    request_id=request_id,
                )
                return error.to_dict()
            if "lat" not in location or "lng" not in location:
                error = ValidationError(
                    "Location dict must contain 'lat' and 'lng' keys",
                    field="location",
                    request_id=request_id,
                )
                return error.to_dict()

        bridge = get_google_places_bridge()
        result = bridge.search(
            query=query,
            location=location,
            radius_meters=radius_meters,
            limit=limit,
            request_id=request_id,
        )
        
        duration_ms = (time.time() - start_time) * 1000

        # Return result in MCP-compatible format
        if result.get("status") == "success":
            log_tool_call(
                "google_places_search",
                request_id,
                "success",
                duration_ms=duration_ms,
                metadata={"limit": limit, "has_location": location is not None},
            )
            return {
                "status": "success",
                "request_id": request_id,
                "output": result.get("output", {}),
                "telemetry": result.get("telemetry", {}),
            }
        else:
            # Result indicates an error or blocked status
            error_code = result.get("status", "error").upper()
            if error_code == "BLOCKED":
                error_code = "EXECUTION_BLOCKED"
            
            error_msg = result.get("error", "Unknown error")
            log_tool_call(
                "google_places_search",
                request_id,
                result.get("status", "error"),
                duration_ms=duration_ms,
                error=error_msg,
            )
            
            return {
                "status": result.get("status", "error"),
                "request_id": request_id,
                "code": error_code,
                "message": error_msg,
                "meta": {},
            }

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_tool_call(
            "google_places_search",
            request_id,
            "error",
            duration_ms=duration_ms,
            error=str(e),
        )
        return format_error_response(e, request_id=request_id, default_code="TOOL_ERROR_GOOGLE_PLACES_SEARCH")

