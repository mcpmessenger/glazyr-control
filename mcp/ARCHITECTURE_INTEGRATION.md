# MCP Connectors Architecture Integration

## Where Do Connectors Fit?

The MCP connectors should be integrated into **`glazyr-control`** as **MCP tools**, not as a separate toolchain.

## Current Architecture

```
┌─────────────────┐
│ Chrome Extension│
│  (background.js)│
└────────┬─────────┘
         │
         └─→ glazyr-control (Python FastAPI)
             ├─ MCP Endpoints
             │  ├─ GET /mcp/manifest  (lists tools)
             │  └─ POST /mcp/invoke    (executes tools)
             │
             └─ Tools (currently)
                └─ agent_executor (LangChain agent)
```

## Proposed Architecture (With Connectors)

```
┌─────────────────┐
│ Chrome Extension│
│  (background.js)│
└────────┬─────────┘
         │
         └─→ glazyr-control (Python FastAPI)
             ├─ MCP Endpoints
             │  ├─ GET /mcp/manifest  (lists tools)
             │  └─ POST /mcp/invoke    (executes tools)
             │
             └─ Tools
                ├─ agent_executor (LangChain agent) ← Brain
                ├─ google_places_search ← Eyes (sensory input)
                ├─ playwright_navigate ← Hands (execution)
                ├─ playwright_extract_text
                ├─ playwright_screenshot
                └─ playwright_click (with approval gates)
```

## Integration Structure

### Option 1: Bridge Pattern (Recommended)

```
glazyr-control/
├── src/
│   ├── mcp.py                    # MCP protocol handler
│   ├── agent.py                  # LangChain agent (brain)
│   ├── connectors/               # NEW: Python bridge to TypeScript connectors
│   │   ├── __init__.py
│   │   ├── google_places.py      # Bridge to Google Places connector
│   │   └── playwright.py         # Bridge to Playwright connector
│   └── ...
│
mcp/                               # TypeScript connector library (existing)
└── connectors/
    ├── google-places/
    └── playwright/
```

### How It Works

1. **Extension/Agent** calls MCP tool: `POST /mcp/invoke { "tool": "google_places_search", ... }`
2. **glazyr-control** routes to Python bridge: `connectors/google_places.py`
3. **Python bridge** calls TypeScript connector via subprocess/HTTP
4. **TypeScript connector** executes (Google Places API or Playwright)
5. **Result** flows back: TypeScript → Python → MCP response → Extension

## Implementation Steps

### Step 1: Create Python Bridge

```python
# glazyr-control/src/connectors/google_places.py
import subprocess
import json
import os
from typing import Dict, Any

def execute_google_places_search(
    query: str,
    location: str = None,
    max_results: int = 10
) -> Dict[str, Any]:
    """Bridge function to call TypeScript Google Places connector"""
    
    # Path to compiled connector
    connector_path = os.path.join(
        os.path.dirname(__file__),
        "../../../mcp/connectors/dist"
    )
    
    # Build MCP step
    step = {
        "step_id": f"places-{int(time.time())}",
        "action": "places_search",
        "input": {
            "query": query,
            "location": location
        }
    }
    
    constraints = {
        "max_results": max_results,
        "budget": {"api_calls": 3}
    }
    
    # Call TypeScript connector via Node.js
    script = f"""
    const {{ GooglePlacesConnector }} = require('{connector_path}/google-places');
    const connector = new GooglePlacesConnector({{
      apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF
    }});
    
    connector.execute({json.dumps(step)}, {json.dumps(constraints)})
      .then(result => console.log(JSON.stringify(result)))
      .catch(err => {{ console.error(err); process.exit(1); }});
    """
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        env={**os.environ}
    )
    
    if result.returncode != 0:
        return {"error": result.stderr}
    
    return json.loads(result.stdout)
```

### Step 2: Add to MCP Manifest

```python
# glazyr-control/src/mcp.py

def mcp_manifest() -> Dict[str, Any]:
    return {
        "protocol": "mcp",
        "version": "0.1",
        "tools": [
            {
                "name": "agent_executor",
                "description": "Run the Glazyr-Control agent to reason/orchestrate",
                # ... existing
            },
            # NEW: Google Places tools
            {
                "name": "google_places_search",
                "description": "Search for places using Google Places API",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "location": {"type": "string", "description": "Location context"},
                        "max_results": {"type": "number", "default": 10}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "google_places_details",
                "description": "Get detailed information about a place",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "place_id": {"type": "string", "description": "Google Place ID"}
                    },
                    "required": ["place_id"]
                }
            },
            # NEW: Playwright tools
            {
                "name": "playwright_navigate",
                "description": "Navigate to a URL using Playwright",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "URL to navigate to"},
                        "allowlist_domains": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Allowed domains"
                        }
                    },
                    "required": ["url"]
                }
            },
            {
                "name": "playwright_extract_text",
                "description": "Extract visible text from current page",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "selector": {"type": "string", "description": "CSS selector (optional)"}
                    }
                }
            },
            {
                "name": "playwright_screenshot",
                "description": "Capture screenshot of current page",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "full_page": {"type": "boolean", "default": false}
                    }
                }
            }
        ]
    }
```

### Step 3: Route Tool Invocations

```python
# glazyr-control/src/mcp.py

def invoke(payload: Any, *, store: TaskStore, model: str) -> Dict[str, Any]:
    tool, inputs = _normalize_invoke_request(payload)
    
    if tool == "agent_executor":
        # Existing agent executor logic
        # ...
    
    elif tool == "google_places_search":
        from .connectors.google_places import execute_google_places_search
        result = execute_google_places_search(
            query=inputs.get("query"),
            location=inputs.get("location"),
            max_results=inputs.get("max_results", 10)
        )
        return {"output": result}
    
    elif tool == "playwright_navigate":
        from .connectors.playwright import execute_playwright_navigate
        result = execute_playwright_navigate(
            url=inputs.get("url"),
            allowlist_domains=inputs.get("allowlist_domains", [])
        )
        return {"output": result}
    
    # ... other tools
    
    else:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool}")
```

## Why This Architecture?

### ✅ Connectors as MCP Tools

- **Unified interface**: All tools exposed via same MCP protocol
- **Agent can use them**: LangChain agent can call connectors as tools
- **Consistent**: Same pattern as `agent_executor`
- **Discoverable**: Tools appear in `/mcp/manifest`

### ✅ Python Bridge Layer

- **Type safety**: Python handles MCP protocol, TypeScript handles execution
- **Error handling**: Python can catch and format errors
- **Policy enforcement**: Python can add additional constraints
- **Caching**: Python can cache results if needed

### ✅ Separation of Concerns

- **TypeScript connectors**: Pure execution logic (no MCP protocol)
- **Python bridge**: Protocol translation + policy
- **glazyr-control**: Orchestration + tool registry

## Alternative: HTTP Bridge (For Production)

Instead of subprocess, use HTTP:

```python
# glazyr-control/src/connectors/google_places.py

import requests

CONNECTOR_SERVICE_URL = os.getenv("CONNECTOR_SERVICE_URL", "http://localhost:3001")

def execute_google_places_search(...) -> Dict[str, Any]:
    response = requests.post(
        f"{CONNECTOR_SERVICE_URL}/connectors/google-places/execute",
        json={"step": step, "constraints": constraints}
    )
    return response.json()
```

Then run connectors as a separate service:

```typescript
// mcp/connectors/server.ts
import express from 'express';
import { GooglePlacesConnector, PlaywrightConnector } from './index';

const app = express();
app.use(express.json());

app.post('/connectors/google-places/execute', async (req, res) => {
  const { step, constraints } = req.body;
  const connector = new GooglePlacesConnector({ apiKeyRef: 'KEY_REF' });
  const result = await connector.execute(step, constraints);
  res.json(result);
});

app.listen(3001);
```

## File Structure Summary

```
glazyr/
├── glazyr-control/              # MCP Runtime (Python)
│   └── src/
│       ├── mcp.py               # MCP protocol + tool registry
│       ├── agent.py             # LangChain agent (brain)
│       └── connectors/          # NEW: Python bridges
│           ├── __init__.py
│           ├── google_places.py
│           └── playwright.py
│
└── mcp/                         # Connector Library (TypeScript)
    └── connectors/
        ├── google-places/       # Google Places connector
        └── playwright/          # Playwright connector
```

## Next Steps

1. **Create Python bridges** in `glazyr-control/src/connectors/`
2. **Add tools to MCP manifest** in `glazyr-control/src/mcp.py`
3. **Route tool invocations** in `glazyr-control/src/mcp.py::invoke()`
4. **Test integration** via MCP endpoints
5. **Update agent** to use new tools (optional - agent can discover via manifest)

## Answer to Your Question

**Should connectors be under "langchain mcp" or "toolchain"?**

**Answer: Neither.** They should be:

- **MCP Tools** registered in `glazyr-control/src/mcp.py`
- **Called via Python bridges** in `glazyr-control/src/connectors/`
- **TypeScript implementation** stays in `mcp/connectors/`

The connectors are **tools that the agent can use**, not a separate toolchain. They're part of the MCP tool ecosystem alongside `agent_executor`.
