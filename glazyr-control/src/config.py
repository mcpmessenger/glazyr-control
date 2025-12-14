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


def load_settings() -> Settings:
    api_key = os.getenv("API_KEY", "").strip()

    payload_max_bytes = int(os.getenv("PAYLOAD_MAX_BYTES", "5242880"))  # 5MB default
    allowed_domains = _split_csv(os.getenv("ALLOWED_DOMAINS", "").strip())

    redis_url = os.getenv("REDIS_URL", "").strip()

    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

    return Settings(
        api_key=api_key,
        payload_max_bytes=payload_max_bytes,
        allowed_domains=allowed_domains,
        redis_url=redis_url,
        openai_api_key=openai_api_key,
        openai_model=openai_model,
    )

