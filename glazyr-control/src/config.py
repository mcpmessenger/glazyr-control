import os
from dataclasses import dataclass
from typing import List


def _split_csv(value: str) -> List[str]:
    parts = [p.strip() for p in (value or "").split(",")]
    return [p for p in parts if p]


@dataclass(frozen=True)
class Settings:
    # Auth
    api_key: str

    # Safety
    payload_max_bytes: int
    allowed_domains: List[str]

    # State
    redis_url: str

    # LLM
    openai_api_key: str
    openai_model: str

    # MCP Routing
    langchain_mcp_url: str
    valuation_mcp_url: str

    # Observability
    sentry_dsn: str
    sentry_enabled: bool
    prometheus_enabled: bool


def load_settings() -> Settings:
    api_key = os.getenv("API_KEY", "").strip()

    payload_max_bytes = int(os.getenv("PAYLOAD_MAX_BYTES", "5242880"))  # 5MB default
    allowed_domains = _split_csv(os.getenv("ALLOWED_DOMAINS", "").strip())

    redis_url = os.getenv("REDIS_URL", "").strip()

    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

    # MCP Routing URLs
    langchain_mcp_url = os.getenv("LANGCHAIN_MCP_URL", "https://langchain-agent-mcp-server-554655392699.us-central1.run.app").strip()
    valuation_mcp_url = os.getenv("VALUATION_MCP_URL", "https://valuation-mcp-server-554655392699.us-central1.run.app").strip()

    # Observability
    sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
    sentry_enabled = os.getenv("SENTRY_ENABLED", "false").lower() in ("true", "1", "yes")
    prometheus_enabled = os.getenv("PROMETHEUS_ENABLED", "true").lower() in ("true", "1", "yes")

    return Settings(
        api_key=api_key,
        payload_max_bytes=payload_max_bytes,
        allowed_domains=allowed_domains,
        redis_url=redis_url,
        openai_api_key=openai_api_key,
        openai_model=openai_model,
        langchain_mcp_url=langchain_mcp_url,
        valuation_mcp_url=valuation_mcp_url,
        sentry_dsn=sentry_dsn,
        sentry_enabled=sentry_enabled,
        prometheus_enabled=prometheus_enabled,
    )

