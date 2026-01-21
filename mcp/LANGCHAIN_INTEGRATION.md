# LangChain Tool Integration Guide

## How LangChain Detects Tools

LangChain agents need tools to be **explicitly bound** to them. There are two approaches:

### Option 1: Bind Tools Directly (Recommended)

Create LangChain tool wrappers and bind them to the agent.

### Option 2: Use MCP Tool Discovery

Load tools from MCP manifest and convert to LangChain tools.

## Current Agent State

Your current `agent.py` is minimal - it just uses `ChatOpenAI` directly without tools:

```python
# Current: No tools bound
llm = ChatOpenAI(model=model, temperature=0)
msg = llm.invoke(prefix + str(input_query))
```

## Solution: Add Tool Binding

### Step 1: Create LangChain Tool Wrappers

```python
# glazyr-control/src/tools/__init__.py
from langchain.tools import Tool
from typing import List

def get_mcp_tools() -> List[Tool]:
    """Convert MCP tools to LangChain tools"""
    from .google_places_tool import GooglePlacesSearchTool
    from .playwright_tool import PlaywrightNavigateTool
    
    return [
        GooglePlacesSearchTool(),
        PlaywrightNavigateTool(),
        # ... other tools
    ]
```

### Step 2: Create Tool Implementations

```python
# glazyr-control/src/tools/google_places_tool.py
from langchain.tools import Tool
from typing import Optional
from ..connectors.google_places import execute_google_places_search

class GooglePlacesSearchTool(Tool):
    name = "google_places_search"
    description = "Search for places using Google Places API. Input should be a JSON string with 'query' and optional 'location' and 'max_results'."
    
    def _run(self, query: str, location: Optional[str] = None, max_results: int = 10) -> str:
        """Execute the tool"""
        result = execute_google_places_search(
            query=query,
            location=location,
            max_results=max_results
        )
        # Convert result to string for LangChain
        import json
        return json.dumps(result.get("output", {}))
    
    async def _arun(self, query: str, location: Optional[str] = None, max_results: int = 10) -> str:
        """Async execution"""
        return self._run(query, location, max_results)
```

### Step 3: Update Agent to Use Tools

```python
# glazyr-control/src/agent.py
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from .tools import get_mcp_tools

def execute_agent(input_query: str, *, model: str, task_id: Optional[str] = None) -> Dict[str, Any]:
    """Agent with tool support"""
    _require_openai_key()
    if ChatOpenAI is None:
        raise AgentError("langchain_openai not available")
    
    # Get tools
    tools = get_mcp_tools()
    
    # Create LLM
    llm = ChatOpenAI(model=model, temperature=0)
    
    # Create prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are Glazyr-Control, an MCP-native orchestration runtime. "
                   "You have access to tools for searching places and automating browsers. "
                   "Use tools when appropriate to help the user."),
        ("user", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    # Create agent with tools
    agent = create_openai_tools_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    
    # Execute
    result = agent_executor.invoke({"input": input_query})
    
    return {"output": result.get("output", "")}
```

## Alternative: Simpler Approach (Tool Calling)

If you want to keep it simpler, use OpenAI's function calling:

```python
# glazyr-control/src/agent.py
from langchain_openai import ChatOpenAI
from langchain.tools import StructuredTool
import json

def execute_agent(input_query: str, *, model: str, task_id: Optional[str] = None) -> Dict[str, Any]:
    """Agent with function calling"""
    _require_openai_key()
    
    llm = ChatOpenAI(model=model, temperature=0)
    
    # Define tools as functions
    tools = [
        StructuredTool.from_function(
            func=lambda query, location=None: execute_google_places_search(query, location),
            name="google_places_search",
            description="Search for places using Google Places API"
        ),
        # ... other tools
    ]
    
    # Bind tools to LLM
    llm_with_tools = llm.bind_tools(tools)
    
    # Invoke with tools
    response = llm_with_tools.invoke(input_query)
    
    # Handle tool calls if any
    if hasattr(response, 'tool_calls') and response.tool_calls:
        # Execute tool calls
        results = []
        for tool_call in response.tool_calls:
            tool_result = tools[tool_call['name']].invoke(tool_call['args'])
            results.append(tool_result)
        
        # Continue conversation with tool results
        follow_up = llm_with_tools.invoke([
            {"role": "user", "content": input_query},
            response,
            {"role": "tool", "content": json.dumps(results)}
        ])
        
        return {"output": follow_up.content}
    
    return {"output": response.content}
```

## Extension Integration: Should You Add It?

### Answer: **It Depends on the Connector**

| Connector | Where It Runs | Why |
|-----------|---------------|-----|
| **Google Places** | `glazyr-control` (server) | ✅ API calls, no local execution needed |
| **Playwright** | **Extension (local)** | ✅ Security: browser automation should run locally |

### Architecture Decision

```
┌─────────────────┐
│ Chrome Extension│
│  (background.js)│
└────────┬─────────┘
         │
         ├─→ glazyr-control (server)
         │   ├─ Google Places (API calls)
         │   └─ LangChain Agent (brain)
         │
         └─→ Playwright Connector (local in extension)
             └─ Browser automation (secure, local)
```

### Why Playwright Should Be in Extension

1. **Security**: Browser automation runs in user's environment
2. **Performance**: No network latency for browser operations
3. **Access**: Extension has access to page context
4. **Policy**: Local enforcement of safety constraints

### Implementation: Playwright in Extension

```typescript
// glazyr-extension/src/connectors/playwright-bridge.ts
import { PlaywrightConnector, PlaywrightPolicy } from '../../mcp/connectors/dist';

let connector: PlaywrightConnector | null = null;

export async function executePlaywrightStep(
  step: MCPStep,
  constraints: MCPConstraints
): Promise<ExecutionResult> {
  if (!connector) {
    connector = new PlaywrightConnector(
      { headless: false }, // Show browser
      new PlaywrightPolicy()
    );
  }
  
  // Resolve text references from extension storage
  if (step.input.text_ref) {
    const stored = await chrome.storage.local.get(`secure_${step.input.text_ref}`);
    step.input.text = stored[`secure_${step.input.text_ref}`];
  }
  
  // Execute
  return await connector.execute(step, constraints);
}

// In background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_PLAYWRIGHT') {
    executePlaywrightStep(message.step, message.constraints)
      .then(sendResponse);
    return true;
  }
});
```

### How Extension Calls Playwright

```typescript
// Extension calls Playwright locally
const result = await chrome.runtime.sendMessage({
  type: 'EXECUTE_PLAYWRIGHT',
  step: {
    step_id: 's1',
    action: 'open_url',
    input: { url: 'https://example.com' }
  },
  constraints: {
    allowlist_domains: ['example.com']
  }
});
```

### How Agent Uses Playwright (Via Extension)

The agent in `glazyr-control` can't directly call Playwright. Instead:

1. **Agent decides** it needs to navigate to a URL
2. **Agent returns instruction** to extension: "Navigate to https://example.com"
3. **Extension executes** Playwright locally
4. **Extension reports result** back to agent

Or use a hybrid approach:

```python
# glazyr-control/src/tools/playwright_tool.py
class PlaywrightNavigateTool(Tool):
    name = "playwright_navigate"
    description = "Navigate to a URL. Returns an instruction for the extension to execute."
    
    def _run(self, url: str) -> str:
        """Return instruction for extension"""
        return json.dumps({
            "action": "playwright_navigate",
            "url": url,
            "execute_in": "extension"  # Signal to extension
        })
```

Then the extension handles the actual execution.

## Recommended Architecture

### Google Places: Server-Side (glazyr-control)

```python
# glazyr-control/src/tools/google_places_tool.py
# Direct tool binding - runs in glazyr-control
```

### Playwright: Client-Side (Extension)

```typescript
// glazyr-extension/src/connectors/playwright-bridge.ts
// Runs locally in extension
```

### Agent Orchestration

```
User Query → Extension → glazyr-control
                              │
                              ├─→ Agent (LangChain)
                              │   ├─ Uses: google_places_search (server)
                              │   └─ Returns: playwright_navigate (instruction)
                              │
                              └─→ Extension executes Playwright locally
```

## Complete Integration Example

### 1. Add Google Places Tool to LangChain

```python
# glazyr-control/src/tools/google_places_tool.py
from langchain.tools import Tool
from ..connectors.google_places import execute_google_places_search

def google_places_search_tool() -> Tool:
    return Tool(
        name="google_places_search",
        description="Search for places. Input: JSON with 'query' and optional 'location'.",
        func=lambda input_str: json.dumps(
            execute_google_places_search(**json.loads(input_str))
        )
    )
```

### 2. Update Agent

```python
# glazyr-control/src/agent.py
from .tools.google_places_tool import google_places_search_tool

def execute_agent(input_query: str, *, model: str, task_id: Optional[str] = None) -> Dict[str, Any]:
    llm = ChatOpenAI(model=model, temperature=0)
    
    # Bind tools
    tools = [google_places_search_tool()]
    llm_with_tools = llm.bind_tools(tools)
    
    # Invoke
    response = llm_with_tools.invoke(input_query)
    
    # Handle tool calls
    if hasattr(response, 'tool_calls') and response.tool_calls:
        # Execute tools and continue conversation
        # ...
    
    return {"output": response.content}
```

### 3. Extension Handles Playwright

```typescript
// Extension receives agent response with Playwright instruction
// Extension executes Playwright locally
// Extension reports back to agent
```

## Summary

### LangChain Tool Detection

✅ **Bind tools explicitly** to the agent using:
- `llm.bind_tools(tools)` for function calling
- `create_openai_tools_agent()` for full agent executor

### Extension Integration

✅ **Google Places**: Add to `glazyr-control` (server-side tool)
❌ **Playwright**: Keep in extension (client-side execution)

The agent can use Google Places directly, but Playwright should be executed by the extension for security.
