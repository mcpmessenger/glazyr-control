# Quick Integration Guide

## TL;DR

1. **Google Places** → Add to `glazyr-control` as LangChain tool ✅
2. **Playwright** → Keep in extension, agent sends instructions ⚠️
3. **LangChain** → Bind tools explicitly using `bind_tools()` or `create_openai_tools_agent()`

## Step-by-Step

### Step 1: Add Google Places to LangChain (5 minutes)

```python
# glazyr-control/src/tools/google_places_tool.py
from langchain.tools import Tool
from ..connectors.google_places import execute_google_places_search
import json

def google_places_search_tool() -> Tool:
    return Tool(
        name="google_places_search",
        description="Search for places using Google Places API",
        func=lambda query, location=None: json.dumps(
            execute_google_places_search(query, location).get("output", {})
        )
    )
```

```python
# glazyr-control/src/agent.py
from langchain_openai import ChatOpenAI
from .tools.google_places_tool import google_places_search_tool

def execute_agent(input_query: str, *, model: str, task_id: Optional[str] = None) -> Dict[str, Any]:
    llm = ChatOpenAI(model=model, temperature=0)
    
    # Bind tool
    tools = [google_places_search_tool()]
    llm_with_tools = llm.bind_tools(tools)
    
    # Agent can now use the tool!
    response = llm_with_tools.invoke(input_query)
    
    # Handle tool calls if any
    # ...
    
    return {"output": response.content}
```

### Step 2: Playwright Stays in Extension

```typescript
// glazyr-extension/src/connectors/playwright-bridge.ts
// Already set up - agent sends instructions, extension executes
```

## Testing

1. **Test Google Places tool**:
   ```bash
   curl -X POST http://localhost:8012/mcp/invoke \
     -H "Content-Type: application/json" \
     -d '{"tool": "agent_executor", "arguments": {"input": "Find coffee shops in San Francisco"}}'
   ```

2. **Agent should**:
   - Detect it needs to search places
   - Call `google_places_search` tool
   - Return results

## Answer to Your Questions

### Q: How does LangChain detect the tool?

**A:** You must **bind tools explicitly**:
- Use `llm.bind_tools([tool1, tool2])` for function calling
- Or `create_openai_tools_agent(llm, tools)` for full agent

LangChain **doesn't auto-discover** - you must pass tools to the agent.

### Q: Should I add it to the extension?

**A:** 
- ✅ **Google Places**: Add to `glazyr-control` (server-side tool)
- ❌ **Playwright**: Keep in extension (client-side execution)

Playwright runs locally in extension for security. Agent sends instructions, extension executes.
