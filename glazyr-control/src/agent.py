from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, List, Optional

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from .tracing import get_request_id
from .telemetry import log_agent_execution

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
except Exception:  # pragma: no cover
    ChatOpenAI = None  # type: ignore
    AIMessage = None  # type: ignore
    HumanMessage = None  # type: ignore
    ToolMessage = None  # type: ignore


class AgentError(Exception):
    pass


def _require_openai_key() -> None:
    if not os.getenv("OPENAI_API_KEY", "").strip():
        raise AgentError("OPENAI_API_KEY is not set")


def _should_retry(exc: BaseException) -> bool:
    # Don't retry for deterministic configuration/policy errors.
    if isinstance(exc, AgentError):
        return False
    return True


def _get_tools() -> List[Any]:
    """
    Get list of available LangChain tools.
    
    Returns:
        List of LangChain tool instances
    """
    tools = []
    
    # Google Places tool
    try:
        from .tools.google_places_tool import google_places_search_tool
        tools.append(google_places_search_tool)
    except ImportError:
        pass  # Tool not available
    
    # Valuation MCP tools
    try:
        from .tools.valuation_tools import (
            analyze_github_repository_tool,
            calculate_valuation_tool,
            compare_with_market_tool,
        )
        tools.extend([
            analyze_github_repository_tool,
            calculate_valuation_tool,
            compare_with_market_tool,
        ])
    except ImportError:
        pass  # Tools not available
    
    return tools


@retry(retry=retry_if_exception(_should_retry), stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def execute_agent(input_query: str, *, model: str, task_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Agent executor with tool support.
    - Retries transient failures.
    - Supports LangChain tool binding and execution.
    - Returns a small dict so callers can shape MCP response.
    """
    _require_openai_key()
    if ChatOpenAI is None:
        raise AgentError("langchain_openai not available (dependency install required)")
    if HumanMessage is None:
        raise AgentError("langchain_core not available (dependency install required)")

    # Get available tools
    tools = _get_tools()
    
    # Initialize LLM
    llm = ChatOpenAI(model=model, temperature=0)
    
    # Bind tools to LLM if available
    if tools:
        llm_with_tools = llm.bind_tools(tools)
    else:
        llm_with_tools = llm

    # Keep prompt short; caller is responsible for any tool protocol and safety boundaries.
    prefix = "You are Glazyr-Control, an MCP-native orchestration runtime.\n"
    if task_id:
        prefix += f"(task_id: {task_id})\n"
    prefix += "Answer succinctly. If policy or data is insufficient, say what is missing.\n\n"
    if tools:
        prefix += "You have access to tools that can help answer questions. Use them when appropriate.\n\n"

    # Create message history
    messages = [HumanMessage(content=prefix + str(input_query))]
    max_iterations = 5  # Limit tool call iterations to prevent infinite loops
    tool_calls_count = 0
    request_id = get_request_id() or str(uuid.uuid4())
    start_time = time.time()
    
    try:
        for iteration in range(max_iterations):
            # Invoke LLM
            response = llm_with_tools.invoke(messages)
            messages.append(response)
            
            # Check for tool calls (tool_calls is a list of dicts with 'name', 'args', 'id', 'type')
            tool_calls = getattr(response, "tool_calls", None) or []
            
            if not tool_calls:
                # No tool calls, extract final answer
                text = getattr(response, "content", None)
                if isinstance(text, list):
                    text = "\n".join([str(x) for x in text])
                out = str(text or "").strip()
                if not out:
                    # If no content, check if there's a response message
                    out = str(response) if response else ""
                
                duration_ms = (time.time() - start_time) * 1000
                log_agent_execution(
                    request_id=request_id,
                    status="success",
                    duration_ms=duration_ms,
                    tool_calls=tool_calls_count,
                )
                return {"output": out, "tool_calls_count": tool_calls_count}
        
            # Execute tool calls
            for tool_call in tool_calls:
                tool_calls_count += 1
                # Handle both dict format and object format
                if isinstance(tool_call, dict):
                    tool_name = tool_call.get("name", "")
                    tool_input = tool_call.get("args", {})
                    tool_call_id = tool_call.get("id", "")
                else:
                    # Object format (has attributes)
                    tool_name = getattr(tool_call, "name", "")
                    tool_input = getattr(tool_call, "args", {})
                    tool_call_id = getattr(tool_call, "id", "")
                
                # Find the tool
                tool_func = None
                for tool in tools:
                    if tool.name == tool_name:
                        tool_func = tool
                        break
                
                if tool_func is None:
                    tool_result = f"Error: Tool '{tool_name}' not found"
                else:
                    try:
                        # Execute the tool
                        tool_result = tool_func.invoke(tool_input)
                    except Exception as e:
                        tool_result = f"Error executing {tool_name}: {str(e)}"
                
                # Add tool result to message history
                messages.append(
                    ToolMessage(
                        content=str(tool_result),
                        tool_call_id=tool_call_id or str(uuid.uuid4()),
                    )
                )
        
        # Max iterations reached, return last response
        text = getattr(messages[-1], "content", None)
        if isinstance(text, list):
            text = "\n".join([str(x) for x in text])
        out = str(text or "").strip()
        
        duration_ms = (time.time() - start_time) * 1000
        log_agent_execution(
            request_id=request_id,
            status="success",
            duration_ms=duration_ms,
            tool_calls=tool_calls_count,
            metadata={"max_iterations_reached": True},
        )
        return {"output": out, "tool_calls_count": tool_calls_count}
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_agent_execution(
            request_id=request_id,
            status="error",
            duration_ms=duration_ms,
            error=str(e),
            tool_calls=tool_calls_count,
        )
        raise

