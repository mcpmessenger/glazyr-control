import hashlib
import json
import re
from typing import Any, Dict, Iterable, Optional, Tuple
from urllib.parse import urlparse

from fastapi import HTTPException, Request


def _normalize_host(host: str) -> str:
    h = (host or "").strip().lower()
    if not h:
        return ""
    # drop port if present
    return h.split(":")[0]


def _host_allowed(host: str, allowed: Iterable[str]) -> bool:
    h = _normalize_host(host)
    if not allowed:
        return True
    for rule in allowed:
        r = _normalize_host(rule)
        if not r:
            continue
        if r == "*":
            return True
        if r.startswith("*."):
            suffix = r[2:]
            if h == suffix or h.endswith("." + suffix):
                return True
        if h == r or h.endswith("." + r):
            return True
    return False


_URL_RE = re.compile(r"https?://[^\s\"']+", re.IGNORECASE)


def _extract_urls(obj: Any) -> Iterable[str]:
    # Conservative extraction: scan strings for http(s):// and recurse into JSON-ish structures.
    if obj is None:
        return
    if isinstance(obj, str):
        for m in _URL_RE.finditer(obj):
            yield m.group(0)
        return
    if isinstance(obj, (int, float, bool)):
        return
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _extract_urls(v)
        return
    if isinstance(obj, (list, tuple)):
        for v in obj:
            yield from _extract_urls(v)
        return


def validate_allowlist(payload: Any, allowed_domains: Iterable[str]) -> None:
    if not allowed_domains:
        return
    for u in _extract_urls(payload):
        try:
            host = urlparse(u).hostname or ""
        except Exception:
            host = ""
        if host and not _host_allowed(host, allowed_domains):
            raise HTTPException(status_code=403, detail=f"URL host not allowlisted: {host}")


def extract_api_key(headers: Dict[str, str]) -> str:
    # Accept either:
    # - Authorization: Bearer <key>
    # - x-glazyr-api-key: <key>
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    xk = headers.get("x-glazyr-api-key") or headers.get("X-Glazyr-Api-Key") or ""
    return str(xk).strip()


async def read_body_with_replay(request: Request) -> Tuple[bytes, Optional[Any]]:
    """
    Reads request body once and replays it so downstream handlers can read it again.
    Returns (raw_body, parsed_json_or_none).
    """
    body = await request.body()

    async def receive() -> Dict[str, Any]:
        return {"type": "http.request", "body": body, "more_body": False}

    # Patch request internals for downstream reads.
    request._receive = receive  # type: ignore[attr-defined]

    parsed: Optional[Any] = None
    if body:
        try:
            parsed = json.loads(body.decode("utf-8"))
        except Exception:
            parsed = None
    return body, parsed


def safe_text_preview(value: Any, limit: int = 800) -> str:
    s = str(value if value is not None else "").strip()
    if len(s) > limit:
        return s[:limit] + "…"
    return s


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()

