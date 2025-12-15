"""
Tool and instruction schemas for Glazyr.

Defines the exact JSON schemas used for tool calls and Playwright instructions
to ensure consistency across agent, bridges, and extension.
"""

from typing import Any, Dict, List, Optional

# Tool call schema (from LLM to tools)
TOOL_CALL_SCHEMA = {
    "type": "object",
    "properties": {
        "tool": {"type": "string", "description": "Tool name (e.g., 'google_places_search')"},
        "input": {
            "type": "object",
            "description": "Tool-specific input parameters",
        },
        "request_id": {"type": "string", "description": "UUID v4 for request tracing"},
        "meta": {
            "type": "object",
            "properties": {
                "origin": {"type": "string"},
                "task_id": {"type": "string"},
            },
            "additionalProperties": True,
        },
    },
    "required": ["tool", "input"],
}

# Example tool call for google_places_search
GOOGLE_PLACES_SEARCH_TOOL_CALL_EXAMPLE: Dict[str, Any] = {
    "tool": "google_places_search",
    "input": {
        "query": "vegan restaurants near me",
        "location": {"lat": 41.58, "lng": -93.62},
        "radius_meters": 2000,
        "limit": 5,
    },
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "meta": {"origin": "agent-v1"},
}

# Playwright instruction schema (from agent to extension)
PLAYWRIGHT_INSTRUCTION_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["playwright_navigate", "playwright_execute"],
            "description": "Action type",
        },
        "request_id": {"type": "string", "description": "UUID v4 for request tracing"},
        "payload": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to navigate to"},
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["goto", "fill", "click", "screenshot", "extract_text"],
                            },
                            "url": {"type": "string"},
                            "selector": {"type": "string"},
                            "text": {"type": "string"},
                            "text_ref": {"type": "string", "description": "Reference to secure vault value"},
                            "name": {"type": "string"},
                        },
                    },
                },
                "constraints": {
                    "type": "object",
                    "properties": {
                        "confirm_before_click": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Selectors requiring user confirmation before click",
                        },
                        "timeout_seconds": {"type": "number", "default": 30},
                    },
                },
            },
        },
    },
    "required": ["action", "request_id", "payload"],
}

# Example Playwright instruction
PLAYWRIGHT_INSTRUCTION_EXAMPLE: Dict[str, Any] = {
    "action": "playwright_navigate",
    "request_id": "550e8400-e29b-41d4-a716-446655440001",
    "payload": {
        "url": "https://example.com/login",
        "steps": [
            {"type": "goto", "url": "https://example.com/login"},
            {"type": "fill", "selector": "#email", "text_ref": "vault_user_email"},
            {"type": "click", "selector": "#submit"},
            {"type": "screenshot", "name": "post_login"},
        ],
        "constraints": {
            "confirm_before_click": ["#delete-account"],
            "timeout_seconds": 30,
        },
    },
}

# Standard error response schema
ERROR_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {"type": "string", "enum": ["error"], "const": "error"},
        "request_id": {"type": "string"},
        "code": {"type": "string", "description": "Error code (e.g., 'PLAYWRIGHT_NAV_TIMEOUT')"},
        "message": {"type": "string", "description": "Human-readable error message"},
        "meta": {"type": "object", "additionalProperties": True},
    },
    "required": ["status", "request_id", "code", "message"],
}


def validate_tool_call(tool_call: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Validate a tool call against the schema.
    
    Returns:
        (is_valid, error_message)
    """
    if not isinstance(tool_call, dict):
        return False, "Tool call must be a dictionary"
    
    if "tool" not in tool_call:
        return False, "Missing required field: 'tool'"
    
    if "input" not in tool_call:
        return False, "Missing required field: 'input'"
    
    if not isinstance(tool_call["input"], dict):
        return False, "Field 'input' must be a dictionary"
    
    return True, None


def validate_playwright_instruction(instruction: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Validate a Playwright instruction against the schema.
    
    Returns:
        (is_valid, error_message)
    """
    if not isinstance(instruction, dict):
        return False, "Instruction must be a dictionary"
    
    if "action" not in instruction:
        return False, "Missing required field: 'action'"
    
    if instruction["action"] not in ["playwright_navigate", "playwright_execute"]:
        return False, f"Invalid action: {instruction['action']}"
    
    if "request_id" not in instruction:
        return False, "Missing required field: 'request_id'"
    
    if "payload" not in instruction:
        return False, "Missing required field: 'payload'"
    
    if not isinstance(instruction["payload"], dict):
        return False, "Field 'payload' must be a dictionary"
    
    return True, None
