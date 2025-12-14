from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException
from tenacity import RetryError

from .agent import AgentError, execute_agent
from .policy import safe_text_preview, sha256_hex
from .state import TaskStore, TaskSummary


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
            }
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

    try:
        result = execute_agent(input_query, model=model, task_id=task_id)
        out = str(result.get("output") or "").strip()
        out_preview = safe_text_preview(out, 1200)
        out_hash = sha256_hex(out)
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
        return {"task_id": task_id, "output": out, "result": out}
    except AgentError as e:
        msg = str(e)
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
        return {"task_id": task_id, "error": msg}
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
        return {"task_id": task_id, "error": "Internal error", "details": safe_text_preview(msg, 800)}

