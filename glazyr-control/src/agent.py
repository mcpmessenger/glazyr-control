from __future__ import annotations

import os
from typing import Any, Dict, Optional

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

try:
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover
    ChatOpenAI = None  # type: ignore


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


@retry(retry=retry_if_exception(_should_retry), stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def execute_agent(input_query: str, *, model: str, task_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Minimal agent executor.
    - Retries transient failures.
    - Returns a small dict so callers can shape MCP response.
    """
    _require_openai_key()
    if ChatOpenAI is None:
        raise AgentError("langchain_openai not available (dependency install required)")

    llm = ChatOpenAI(model=model, temperature=0)

    # Keep prompt short; caller is responsible for any tool protocol and safety boundaries.
    prefix = "You are Glazyr-Control, an MCP-native orchestration runtime.\n"
    if task_id:
        prefix += f"(task_id: {task_id})\n"
    prefix += "Answer succinctly. If policy or data is insufficient, say what is missing.\n\n"

    msg = llm.invoke(prefix + str(input_query))
    text = getattr(msg, "content", None)
    if isinstance(text, list):
        # Some models return structured content; stringify safely.
        text = "\n".join([str(x) for x in text])
    out = str(text or "").strip()
    return {"output": out}

