"""
Distributed tracing support for Glazyr.

Provides request ID tracking and distributed tracing across services.
"""

import uuid
from contextvars import ContextVar
from typing import Optional

# Context variable for request ID (thread-safe)
_request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    """Get the current request ID from context."""
    return _request_id.get()


def set_request_id(request_id: Optional[str] = None) -> str:
    """
    Set the request ID in context.

    Args:
        request_id: Optional request ID (generates new UUID if not provided)

    Returns:
        The request ID (existing or newly generated)
    """
    if request_id is None:
        request_id = str(uuid.uuid4())
    _request_id.set(request_id)
    return request_id


def generate_request_id() -> str:
    """Generate a new UUID v4 request ID."""
    return str(uuid.uuid4())


class RequestContext:
    """Context manager for request ID tracking."""

    def __init__(self, request_id: Optional[str] = None):
        self.request_id = request_id or generate_request_id()
        self._token = None

    def __enter__(self):
        self._token = _request_id.set(self.request_id)
        return self.request_id

    def __exit__(self, exc_type, exc_val, exc_tb):
        _request_id.reset(self._token)
        return False


# Helper decorator for automatic request ID tracking
def with_request_id(func):
    """Decorator to automatically generate and set request ID for a function."""

    def wrapper(*args, **kwargs):
        req_id = get_request_id() or generate_request_id()
        with RequestContext(req_id):
            return func(*args, **kwargs)

    return wrapper
