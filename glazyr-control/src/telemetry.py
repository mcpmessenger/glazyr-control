"""
Telemetry and structured logging for Glazyr.

Provides centralized telemetry collection, structured logging, and metrics
that can be integrated with observability platforms (Prometheus, Sentry, etc.).
"""

import json
import logging
import os
import time
import uuid
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional

# Try to import Prometheus client (optional)
try:
    from prometheus_client import Counter, Histogram
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    Counter = None  # type: ignore
    Histogram = None  # type: ignore

# Try to import Sentry (optional)
try:
    import sentry_sdk
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
    sentry_sdk = None  # type: ignore

# Configure root logger
logger = logging.getLogger("glazyr")
logger.setLevel(logging.INFO)

# Console handler with structured formatting
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Structured formatter
class StructuredFormatter(logging.Formatter):
    """Formatter that outputs structured JSON logs."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add extra fields
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "tool"):
            log_data["tool"] = record.tool
        if hasattr(record, "connector"):
            log_data["connector"] = record.connector
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "status"):
            log_data["status"] = record.status
        if hasattr(record, "user_id_hash"):
            log_data["user_id_hash"] = record.user_id_hash

        # Add any extra fields
        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "thread",
                "threadName",
            ]:
                if not key.startswith("_"):
                    log_data[key] = value

        return json.dumps(log_data)

console_handler.setFormatter(StructuredFormatter())
logger.addHandler(console_handler)

# Initialize Prometheus metrics if available
if PROMETHEUS_AVAILABLE:
    # Counter metrics
    tool_calls_total = Counter(
        "tool_calls_total",
        "Total number of tool calls",
        ["tool", "status"],
    )
    connector_executions_total = Counter(
        "connector_executions_total",
        "Total number of connector executions",
        ["connector", "status"],
    )
    agent_executions_total = Counter(
        "agent_executions_total",
        "Total number of agent executions",
        ["status"],
    )

    # Histogram metrics (for timing)
    tool_duration_seconds = Histogram(
        "tool_duration_seconds",
        "Tool execution duration in seconds",
        ["tool"],
        buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
    )
    connector_duration_seconds = Histogram(
        "connector_duration_seconds",
        "Connector execution duration in seconds",
        ["connector"],
        buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
    )
    agent_duration_seconds = Histogram(
        "agent_duration_seconds",
        "Agent execution duration in seconds",
        buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
    )
else:
    # Dummy metrics if Prometheus not available
    tool_calls_total = None  # type: ignore
    connector_executions_total = None  # type: ignore
    agent_executions_total = None  # type: ignore
    tool_duration_seconds = None  # type: ignore
    connector_duration_seconds = None  # type: ignore
    agent_duration_seconds = None  # type: ignore


@dataclass
class TelemetryEvent:
    """Structured telemetry event."""

    event_type: str
    request_id: Optional[str] = None
    tool: Optional[str] = None
    connector: Optional[str] = None
    status: Optional[str] = None
    duration_ms: Optional[float] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    user_id_hash: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        # Remove None values
        return {k: v for k, v in data.items() if v is not None}


class TelemetryCollector:
    """Collects and emits telemetry events."""

    def __init__(self):
        self.events: list[TelemetryEvent] = []
        self.metrics: Dict[str, Any] = {}

    def emit(self, event: TelemetryEvent) -> None:
        """Emit a telemetry event."""
        self.events.append(event)

        # Log as structured log
        extra = {
            "request_id": event.request_id,
            "tool": event.tool,
            "connector": event.connector,
            "status": event.status,
            "duration_ms": event.duration_ms,
        }
        if event.user_id_hash:
            extra["user_id_hash"] = event.user_id_hash

        level = logging.INFO
        if event.status == "error":
            level = logging.ERROR
        elif event.status == "blocked":
            level = logging.WARNING

        logger.log(level, f"Telemetry: {event.event_type}", extra=extra)

        # Send to Sentry if error
        if SENTRY_AVAILABLE and event.status == "error" and event.error:
            try:
                with sentry_sdk.push_scope() as scope:
                    if event.request_id:
                        scope.set_tag("request_id", event.request_id)
                    if event.tool:
                        scope.set_tag("tool", event.tool)
                    if event.connector:
                        scope.set_tag("connector", event.connector)
                    scope.set_context("telemetry", event.to_dict())
                    sentry_sdk.capture_message(
                        f"{event.event_type} error: {event.error}",
                        level="error",
                    )
            except Exception:
                # Don't fail if Sentry is misconfigured
                pass

        # Export to Prometheus if available
        if PROMETHEUS_AVAILABLE and event.status:
            try:
                if event.event_type == "tool_call" and event.tool:
                    if tool_calls_total:
                        tool_calls_total.labels(tool=event.tool, status=event.status).inc()
                    if event.duration_ms and tool_duration_seconds:
                        tool_duration_seconds.labels(tool=event.tool).observe(
                            event.duration_ms / 1000.0
                        )

                elif event.event_type == "connector_execution" and event.connector:
                    if connector_executions_total:
                        connector_executions_total.labels(
                            connector=event.connector, status=event.status
                        ).inc()
                    if event.duration_ms and connector_duration_seconds:
                        connector_duration_seconds.labels(connector=event.connector).observe(
                            event.duration_ms / 1000.0
                        )

                elif event.event_type == "agent_execution":
                    if agent_executions_total:
                        agent_executions_total.labels(status=event.status).inc()
                    if event.duration_ms and agent_duration_seconds:
                        agent_duration_seconds.observe(event.duration_ms / 1000.0)
            except Exception:
                # Don't fail if Prometheus is misconfigured
                pass

        # Update metrics (simple counters for now)
        if event.event_type not in self.metrics:
            self.metrics[event.event_type] = {"count": 0, "errors": 0, "total_duration_ms": 0}

        self.metrics[event.event_type]["count"] += 1
        if event.status == "error":
            self.metrics[event.event_type]["errors"] += 1
        if event.duration_ms:
            self.metrics[event.event_type]["total_duration_ms"] += event.duration_ms

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics summary."""
        return self.metrics.copy()

    def clear(self) -> None:
        """Clear collected events and metrics (for testing)."""
        self.events.clear()
        self.metrics.clear()


# Global telemetry collector instance
_telemetry_collector = TelemetryCollector()


def get_telemetry_collector() -> TelemetryCollector:
    """Get the global telemetry collector instance."""
    return _telemetry_collector


def emit_telemetry(
    event_type: str,
    request_id: Optional[str] = None,
    tool: Optional[str] = None,
    connector: Optional[str] = None,
    status: Optional[str] = None,
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    user_id_hash: Optional[str] = None,
) -> None:
    """
    Emit a telemetry event.

    Args:
        event_type: Type of event (e.g., 'tool_call', 'connector_execution')
        request_id: Request ID for tracing
        tool: Tool name if applicable
        connector: Connector name if applicable
        status: Status ('success', 'error', 'blocked')
        duration_ms: Duration in milliseconds
        error: Error message if applicable
        metadata: Additional metadata
        user_id_hash: Hashed user ID for privacy
    """
    event = TelemetryEvent(
        event_type=event_type,
        request_id=request_id,
        tool=tool,
        connector=connector,
        status=status,
        duration_ms=duration_ms,
        error=error,
        metadata=metadata or {},
        user_id_hash=user_id_hash,
    )
    get_telemetry_collector().emit(event)


@contextmanager
def track_execution(
    event_type: str,
    request_id: Optional[str] = None,
    tool: Optional[str] = None,
    connector: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Context manager to track execution time and emit telemetry.

    Usage:
        with track_execution('tool_call', request_id='...', tool='google_places_search'):
            result = tool.execute(...)
    """
    start_time = time.time()
    req_id = request_id or str(uuid.uuid4())
    meta = metadata or {}

    try:
        yield req_id
        duration_ms = (time.time() - start_time) * 1000
        emit_telemetry(
            event_type=event_type,
            request_id=req_id,
            tool=tool,
            connector=connector,
            status="success",
            duration_ms=duration_ms,
            metadata=meta,
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        emit_telemetry(
            event_type=event_type,
            request_id=req_id,
            tool=tool,
            connector=connector,
            status="error",
            duration_ms=duration_ms,
            error=str(e),
            metadata=meta,
        )
        raise


def log_tool_call(
    tool: str,
    request_id: str,
    status: str,
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Log a tool call event."""
    emit_telemetry(
        event_type="tool_call",
        request_id=request_id,
        tool=tool,
        status=status,
        duration_ms=duration_ms,
        error=error,
        metadata=metadata or {},
    )


def log_connector_execution(
    connector: str,
    request_id: str,
    status: str,
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Log a connector execution event."""
    emit_telemetry(
        event_type="connector_execution",
        request_id=request_id,
        connector=connector,
        status=status,
        duration_ms=duration_ms,
        error=error,
        metadata=metadata or {},
    )


def log_agent_execution(
    request_id: str,
    status: str,
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
    tool_calls: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Log an agent execution event."""
    meta = metadata or {}
    if tool_calls is not None:
        meta["tool_calls"] = tool_calls

    emit_telemetry(
        event_type="agent_execution",
        request_id=request_id,
        status=status,
        duration_ms=duration_ms,
        error=error,
        metadata=meta,
    )


# Helper for redacting sensitive information from logs
def redact_sensitive_data(data: Dict[str, Any], keys_to_redact: Optional[list] = None) -> Dict[str, Any]:
    """
    Redact sensitive data from a dictionary.

    Args:
        data: Dictionary to redact
        keys_to_redact: List of keys to redact (default: common sensitive keys)

    Returns:
        Dictionary with sensitive values redacted
    """
    if keys_to_redact is None:
        keys_to_redact = [
            "api_key",
            "apiKey",
            "password",
            "secret",
            "token",
            "access_token",
            "refresh_token",
            "authorization",
        ]

    redacted = data.copy()
    for key, value in redacted.items():
        key_lower = key.lower()
        if any(sensitive_key in key_lower for sensitive_key in keys_to_redact):
            redacted[key] = "***REDACTED***"
        elif isinstance(value, dict):
            redacted[key] = redact_sensitive_data(value, keys_to_redact)
        elif isinstance(value, list):
            redacted[key] = [
                redact_sensitive_data(item, keys_to_redact) if isinstance(item, dict) else item
                for item in value
            ]

    return redacted
