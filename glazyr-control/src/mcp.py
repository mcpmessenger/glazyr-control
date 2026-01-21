from __future__ import annotations

import os
import time
import uuid
import re
import json
from typing import Any, Dict, Optional, Tuple

import requests
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


def invoke(payload: Any, *, store: TaskStore, model: str, settings: Any = None) -> Dict[str, Any]:
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

        # Check for routing prefixes: /langchain or /valuation
        routed_query, target_mcp = _detect_routing_prefix(input_query, settings)
        
        # If routing detected, proxy to the appropriate MCP server
        if target_mcp:
            # Use workaround for Valuation MCP (broken agent_executor)
            # Check if this is a valuation query that can use direct tool calls
            valuation_url = getattr(settings, 'valuation_mcp_url', None)
            if target_mcp == valuation_url and valuation_url and _is_valuation_query(routed_query):
                return _valuation_direct_tool_call_workaround(routed_query, target_mcp, task_id, request_id)
            else:
                return _proxy_to_mcp_server(routed_query, target_mcp, task_id, request_id)

        # Continue with local agent execution (no routing prefix detected)
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


def _detect_routing_prefix(query: str, settings: Any) -> Tuple[str, Optional[str]]:
    """
    Detect routing prefixes in the query and return the cleaned query and target MCP server.
    
    Returns:
        Tuple of (cleaned_query, target_mcp_url or None)
    """
    if not settings:
        return query, None
    
    query_lower = query.lower().strip()
    
    # Check for /langchain prefix
    if query_lower.startswith("/langchain") or query_lower.startswith("/langchain "):
        cleaned = query[10:].strip() if len(query) > 10 else ""
        return cleaned, settings.langchain_mcp_url if hasattr(settings, 'langchain_mcp_url') else None
    
    # Check for /valuation prefix
    if query_lower.startswith("/valuation") or query_lower.startswith("/valuation "):
        cleaned = query[10:].strip() if len(query) > 10 else ""
        return cleaned, settings.valuation_mcp_url if hasattr(settings, 'valuation_mcp_url') else None
    
    return query, None


def _is_valuation_query(query: str) -> bool:
    """
    Check if a query is asking for valuation/unicorn score and can use direct tool calls.
    
    Returns True if the query mentions unicorn score, valuation, or asks to analyze a repo.
    """
    query_lower = query.lower()
    valuation_keywords = [
        "unicorn score",
        "unicorn_score",
        "valuation",
        "value",
        "analyze",
        "calculate",
    ]
    return any(keyword in query_lower for keyword in valuation_keywords)


def _extract_github_repo_from_query(query: str) -> Optional[Tuple[str, str]]:
    """
    Extract GitHub repository owner and repo name from a query string.
    
    Supports formats:
    - https://github.com/owner/repo
    - github.com/owner/repo
    - owner/repo
    
    Returns:
        Tuple of (owner, repo) or None if not found
    """
    # Pattern for full GitHub URL
    url_pattern = r'(?:https?://)?(?:www\.)?github\.com/([\w\-\.]+)/([\w\-\.]+)'
    match = re.search(url_pattern, query, re.IGNORECASE)
    if match:
        return (match.group(1), match.group(2))
    
    # Pattern for owner/repo format (more strict)
    owner_repo_pattern = r'\b([\w\-\.]+)/([\w\-\.]+)\b'
    matches = list(re.finditer(owner_repo_pattern, query))
    
    # Look for patterns that look like GitHub repos (not just any slash)
    for match in matches:
        owner, repo = match.group(1), match.group(2)
        # Basic validation: both parts should be reasonable length and not contain certain chars
        if len(owner) > 0 and len(repo) > 0 and '/' not in owner and '/' not in repo:
            # Avoid matching things like "https://" or dates
            if not owner.startswith('http') and not repo.endswith('.com'):
                return (owner, repo)
    
    return None


def _valuation_direct_tool_call_workaround(query: str, target_mcp_url: str, task_id: str, request_id: str) -> Dict[str, Any]:
    """
    Workaround for broken agent_executor: Make direct tool calls for valuation queries.
    
    This implements the two-step process:
    1. Call analyze_github_repository to get repo_data
    2. Call unicorn_hunter with repo_data to get unicorn score
    
    Args:
        query: The user query (may contain GitHub URL)
        target_mcp_url: The Valuation MCP Server URL
        task_id: Task ID for tracking
        request_id: Request ID for tracing
        
    Returns:
        MCP-formatted response with valuation result
    """
    if not target_mcp_url:
        return {
            "task_id": task_id,
            "error": "Target MCP server URL not configured",
            "request_id": request_id,
        }
    
    base_url = target_mcp_url.rstrip("/")
    
    try:
        # Extract repository from query
        repo_info = _extract_github_repo_from_query(query)
        if not repo_info:
            return {
                "task_id": task_id,
                "request_id": request_id,
                "error": "Could not extract GitHub repository information from query. Please provide repository in format: owner/repo or https://github.com/owner/repo",
            }
        
        owner, repo = repo_info
        
        # Step 1: Analyze repository
        analyze_response = requests.post(
            f"{base_url}/mcp/invoke",
            json={
                "tool": "analyze_github_repository",
                "arguments": {
                    "owner": owner,
                    "repo": repo
                }
            },
            headers={"Content-Type": "application/json"},
            timeout=120,
        )
        
        analyze_response.raise_for_status()
        analyze_result = analyze_response.json()
        
        # Extract repo_data from response
        # The response format is: {"content": [{"type": "text", "text": "<JSON_STRING>"}]}
        if not analyze_result.get("content") or len(analyze_result["content"]) == 0:
            return {
                "task_id": task_id,
                "request_id": request_id,
                "error": "Failed to get repository analysis: empty response",
            }
        
        repo_data_text = analyze_result["content"][0].get("text", "")
        if not repo_data_text:
            return {
                "task_id": task_id,
                "request_id": request_id,
                "error": "Failed to get repository analysis: no data in response",
            }
        
        # Parse the JSON string from the text field
        try:
            repo_data = json.loads(repo_data_text)
        except json.JSONDecodeError as e:
            # If it's already a dict, use it directly
            if isinstance(repo_data_text, dict):
                repo_data = repo_data_text
            else:
                return {
                    "task_id": task_id,
                    "request_id": request_id,
                    "error": f"Failed to parse repository analysis data: {str(e)}",
                }
        
        # Step 2: Calculate unicorn score using unicorn_hunter
        unicorn_response = requests.post(
            f"{base_url}/mcp/invoke",
            json={
                "tool": "unicorn_hunter",
                "arguments": {
                    "repo_data": repo_data
                }
            },
            headers={"Content-Type": "application/json"},
            timeout=120,
        )
        
        unicorn_response.raise_for_status()
        unicorn_result = unicorn_response.json()
        
        # Extract the final result
        if not unicorn_result.get("content") or len(unicorn_result["content"]) == 0:
            return {
                "task_id": task_id,
                "request_id": request_id,
                "error": "Failed to get unicorn score: empty response",
            }
        
        valuation_text = unicorn_result["content"][0].get("text", "")
        if not valuation_text:
            return {
                "task_id": task_id,
                "request_id": request_id,
                "error": "Failed to get unicorn score: no data in response",
            }
        
        # Return in MCP-compatible format
        return {
            "task_id": task_id,
            "request_id": request_id,
            "output": valuation_text,
            "result": valuation_text,
        }
        
    except requests.exceptions.Timeout:
        return {
            "task_id": task_id,
            "error": "Request to Valuation MCP server timed out",
            "request_id": request_id,
        }
    except requests.exceptions.HTTPError as e:
        try:
            error_data = e.response.json()
            error_msg = error_data.get("error", str(e))
        except:
            error_msg = str(e)
        return {
            "task_id": task_id,
            "error": f"Valuation MCP server error: {error_msg}",
            "request_id": request_id,
        }
    except Exception as e:
        return {
            "task_id": task_id,
            "error": f"Failed to get valuation: {str(e)}",
            "request_id": request_id,
        }


def _proxy_to_mcp_server(query: str, target_mcp_url: str, task_id: str, request_id: str) -> Dict[str, Any]:
    """
    Proxy a query to an external MCP server.
    
    Args:
        query: The query to send (prefix already removed)
        target_mcp_url: The target MCP server URL
        task_id: Task ID for tracking
        request_id: Request ID for tracing
        
    Returns:
        MCP-formatted response
    """
    if not target_mcp_url:
        return {
            "task_id": task_id,
            "error": "Target MCP server URL not configured",
            "request_id": request_id,
        }
    
    try:
        # Normalize URL (remove trailing slash)
        base_url = target_mcp_url.rstrip("/")
        
        # Forward the request to the target MCP server
        # Increase timeout for complex valuation queries that may require multiple tool calls
        response = requests.post(
            f"{base_url}/mcp/invoke",
            json={
                "tool": "agent_executor",
                "inputs": {
                    "input": query,
                    "task_id": task_id,
                    "request_id": request_id,
                },
            },
            headers={"Content-Type": "application/json"},
            timeout=180,  # Increased timeout for valuation analysis (may require analyze + unicorn_hunter)
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Return in MCP-compatible format
        return {
            "task_id": task_id,
            "request_id": request_id,
            "output": result.get("output", result.get("result", "")),
            "result": result.get("output", result.get("result", "")),
        }
        
    except requests.exceptions.Timeout:
        return {
            "task_id": task_id,
            "error": "Request to MCP server timed out",
            "request_id": request_id,
        }
    except requests.exceptions.HTTPError as e:
        try:
            error_data = e.response.json()
            error_msg = error_data.get("error", str(e))
        except:
            error_msg = str(e)
        return {
            "task_id": task_id,
            "error": f"MCP server error: {error_msg}",
            "request_id": request_id,
        }
    except Exception as e:
        return {
            "task_id": task_id,
            "error": f"Failed to proxy to MCP server: {str(e)}",
            "request_id": request_id,
        }


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

