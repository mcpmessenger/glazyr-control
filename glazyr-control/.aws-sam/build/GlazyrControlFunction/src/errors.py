"""
Structured error handling for Glazyr.

Provides standardized error response formats following the ERROR_RESPONSE_SCHEMA.
"""

import uuid
from typing import Any, Dict, Optional


class GlazyrError(Exception):
    """Base exception for Glazyr errors."""

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        request_id: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code or "INTERNAL_ERROR"
        self.request_id = request_id or str(uuid.uuid4())
        self.meta = meta or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to structured response format."""
        return {
            "status": "error",
            "request_id": self.request_id,
            "code": self.code,
            "message": self.message,
            "meta": self.meta,
        }


class ToolError(GlazyrError):
    """Error during tool execution."""

    def __init__(self, message: str, tool_name: str, **kwargs):
        super().__init__(message, code=f"TOOL_ERROR_{tool_name.upper()}", **kwargs)
        self.tool_name = tool_name
        if not self.meta:
            self.meta = {}
        self.meta["tool"] = tool_name


class ConnectorError(GlazyrError):
    """Error from connector execution."""

    def __init__(self, message: str, connector_name: str, **kwargs):
        super().__init__(message, code=f"CONNECTOR_ERROR_{connector_name.upper()}", **kwargs)
        self.connector_name = connector_name
        if not self.meta:
            self.meta = {}
        self.meta["connector"] = connector_name


class ValidationError(GlazyrError):
    """Input validation error."""

    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        super().__init__(message, code="VALIDATION_ERROR", **kwargs)
        self.field = field
        if field and not self.meta:
            self.meta = {}
        if field:
            self.meta["field"] = field


class TimeoutError(GlazyrError):
    """Operation timeout error."""

    def __init__(self, message: str = "Operation timed out", timeout_seconds: Optional[float] = None, **kwargs):
        super().__init__(message, code="TIMEOUT_ERROR", **kwargs)
        self.timeout_seconds = timeout_seconds
        if timeout_seconds and not self.meta:
            self.meta = {}
        if timeout_seconds:
            self.meta["timeout_seconds"] = timeout_seconds


class AuthenticationError(GlazyrError):
    """Authentication/authorization error."""

    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(message, code="AUTH_ERROR", **kwargs)


def format_error_response(
    error: Exception,
    request_id: Optional[str] = None,
    default_code: str = "INTERNAL_ERROR",
) -> Dict[str, Any]:
    """
    Format any exception as a structured error response.
    
    Args:
        error: The exception to format
        request_id: Optional request ID (uses error.request_id if available)
        default_code: Default error code if exception doesn't have one
        
    Returns:
        Dict following ERROR_RESPONSE_SCHEMA
    """
    if isinstance(error, GlazyrError):
        req_id = request_id or error.request_id
        return {
            "status": "error",
            "request_id": req_id,
            "code": error.code,
            "message": error.message,
            "meta": error.meta,
        }
    
    # Handle standard exceptions
    message = str(error)
    code = default_code
    
    # Map common exception types to error codes
    if isinstance(error, TimeoutError):
        code = "TIMEOUT_ERROR"
    elif isinstance(error, ValueError):
        code = "VALIDATION_ERROR"
    elif isinstance(error, KeyError):
        code = "VALIDATION_ERROR"
        message = f"Missing required field: {message}"
    elif isinstance(error, PermissionError):
        code = "AUTH_ERROR"
    
    return {
        "status": "error",
        "request_id": request_id or str(uuid.uuid4()),
        "code": code,
        "message": message,
        "meta": {},
    }
