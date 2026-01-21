# MCP Connectors Architecture Findings & Recommendations

**Date**: December 14, 2025  
**Status**: Ready for Review

## Executive Summary

This document outlines findings on integrating the MCP connectors (Google Places and Playwright) into the Glazyr architecture, including LangChain tool detection and extension integration decisions.

## Key Findings

### 1. Where Connectors Fit in Architecture

**Finding**: Connectors should be integrated as **MCP tools** in `glazyr-control`, not as a separate toolchain or under "langchain mcp".

**Current Architecture**:
```
Extension → glazyr-control (Python FastAPI)
                └─ MCP Tools: agent_executor (only)
```

**Proposed Architecture**:
```
Extension → glazyr-control (Python FastAPI)
                └─ MCP Tools:
                    ├─ agent_executor (LangChain agent - brain)
                    ├─ google_places_search (sensory input - eyes)
                    ├─ playwright_navigate (execution - hands)
                    └─ playwright_screenshot (execution - hands)
```

**Recommendation**: 
- ✅ Add connectors as MCP tools in `glazyr-control/src/mcp.py`
- ✅ Create Python bridges in `glazyr-control/src/connectors/`
- ✅ Keep TypeScript implementation in `mcp/connectors/`

### 2. LangChain Tool Detection

**Finding**: LangChain **does not auto-detect tools**. Tools must be **explicitly bound** to the agent.

**Current State**: 
- `glazyr-control/src/agent.py` uses `ChatOpenAI` directly
- No tools are bound to the agent
- Agent cannot use external tools

**Solution**: Bind tools explicitly using one of these approaches:

#### Option A: Function Calling (Simpler)
```python
from langchain_openai import ChatOpenAI
from langchain.tools import Tool

tools = [Tool(name="google_places_search", func=search_places, ...)]
llm = ChatOpenAI(model=model)
llm_with_tools = llm.bind_tools(tools)  # ← Explicit binding required
```

#### Option B: Agent Executor (Full Agent)
```python
from langchain.agents import create_openai_tools_agent, AgentExecutor

tools = [google_places_search_tool(), ...]
agent = create_openai_tools_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)
```

**Recommendation**: 
- ✅ Use `bind_tools()` for function calling (simpler, faster)
- ✅ Or use `create_openai_tools_agent()` for full agent executor
- ❌ Do not rely on auto-discovery (doesn't exist)

### 3. Extension Integration Decision

**Finding**: **Different connectors should run in different locations** based on security and architecture requirements.

| Connector | Recommended Location | Rationale |
|-----------|---------------------|-----------|
| **Google Places** | `glazyr-control` (server) | ✅ API calls, no local execution needed<br>✅ Can be used directly by LangChain agent<br>✅ Centralized API key management |
| **Playwright** | **Extension (local)** | ✅ Security: browser automation should run locally<br>✅ Performance: no network latency<br>✅ Access: extension has page context<br>✅ Policy: local enforcement of constraints |

**Architecture Flow**:

```
User Query
    ↓
Extension → glazyr-control
                ↓
            Agent (LangChain)
                ├─→ Uses: google_places_search (server-side tool)
                │   └─→ Returns: Place results
                │
                └─→ Returns: playwright_navigate instruction
                    ↓
            Extension executes Playwright locally
                └─→ Reports result back to agent
```

**Recommendation**:
- ✅ **Google Places**: Add as LangChain tool in `glazyr-control`
- ✅ **Playwright**: Keep in extension, agent sends instructions
- ✅ Extension executes Playwright and reports results back

## Implementation Recommendations

### Phase 1: Google Places Integration (Server-Side)

**Location**: `glazyr-control/src/`

**Files to Create**:
1. `glazyr-control/src/connectors/google_places.py` - Python bridge
2. `glazyr-control/src/tools/google_places_tool.py` - LangChain tool wrapper
3. Update `glazyr-control/src/mcp.py` - Add to manifest
4. Update `glazyr-control/src/agent.py` - Bind tool to agent

**Benefits**:
- Agent can directly use Google Places
- Centralized API key management
- No extension changes needed

### Phase 2: Playwright Integration (Client-Side)

**Location**: `glazyr-extension/src/connectors/`

**Files to Create**:
1. `glazyr-extension/src/connectors/playwright-bridge.ts` - Extension bridge
2. Update `glazyr-extension/src/background.js` - Handle Playwright messages

**Benefits**:
- Secure local execution
- Access to page context
- Local policy enforcement

**Communication Pattern**:
- Agent returns instruction: `{"action": "playwright_navigate", "url": "..."}`
- Extension executes locally
- Extension reports result back to agent

## File Structure

### Recommended Structure

```
glazyr/
├── glazyr-control/              # MCP Runtime (Python)
│   └── src/
│       ├── mcp.py               # MCP protocol + tool registry
│       ├── agent.py             # LangChain agent (update to bind tools)
│       ├── connectors/          # NEW: Python bridges
│       │   ├── __init__.py
│       │   └── google_places.py # Bridge to TypeScript connector
│       └── tools/               # NEW: LangChain tool wrappers
│           ├── __init__.py
│           └── google_places_tool.py
│
├── glazyr-extension/            # Chrome Extension
│   └── src/
│       └── connectors/          # NEW: Extension bridges
│           └── playwright-bridge.ts
│
└── mcp/                         # Connector Library (TypeScript)
    └── connectors/
        ├── google-places/       # Google Places connector
        └── playwright/          # Playwright connector
```

## Integration Steps

### Step 1: Google Places (Server-Side)

1. **Create Python bridge** (`glazyr-control/src/connectors/google_places.py`)
   - Calls TypeScript connector via subprocess or HTTP
   - Handles error translation
   - Enforces additional constraints if needed

2. **Create LangChain tool** (`glazyr-control/src/tools/google_places_tool.py`)
   - Wraps Python bridge as LangChain Tool
   - Defines tool schema (name, description, input)

3. **Update agent** (`glazyr-control/src/agent.py`)
   - Import tool
   - Bind to LLM: `llm.bind_tools([google_places_search_tool()])`
   - Handle tool calls in agent execution

4. **Add to MCP manifest** (`glazyr-control/src/mcp.py`)
   - Add `google_places_search` to tools list
   - Route invocations in `invoke()` function

### Step 2: Playwright (Client-Side)

1. **Create extension bridge** (`glazyr-extension/src/connectors/playwright-bridge.ts`)
   - Import compiled Playwright connector
   - Resolve text references from extension storage
   - Handle approval UI for high-risk actions

2. **Update background script** (`glazyr-extension/src/background.js`)
   - Add message handler for Playwright execution
   - Route to bridge function
   - Send results back to agent

3. **Agent integration** (in `glazyr-control`)
   - Agent returns Playwright instructions (not direct execution)
   - Extension executes and reports back
   - Agent continues with results

## Technical Details

### LangChain Tool Binding

**Current Code** (No tools):
```python
# glazyr-control/src/agent.py
llm = ChatOpenAI(model=model, temperature=0)
msg = llm.invoke(prefix + str(input_query))
```

**Updated Code** (With tools):
```python
# glazyr-control/src/agent.py
from .tools.google_places_tool import google_places_search_tool

tools = [google_places_search_tool()]
llm = ChatOpenAI(model=model, temperature=0)
llm_with_tools = llm.bind_tools(tools)  # ← Required for tool detection

response = llm_with_tools.invoke(input_query)

# Handle tool calls
if hasattr(response, 'tool_calls') and response.tool_calls:
    # Execute tools and continue conversation
    # ...
```

### Python Bridge Pattern

```python
# glazyr-control/src/connectors/google_places.py
import subprocess
import json
import os

def execute_google_places_search(query: str, location: str = None) -> Dict[str, Any]:
    """Bridge to TypeScript connector"""
    connector_path = os.path.join(
        os.path.dirname(__file__),
        "../../../mcp/connectors/dist"
    )
    
    script = f"""
    const {{ GooglePlacesConnector }} = require('{connector_path}/google-places');
    const connector = new GooglePlacesConnector({{
      apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF
    }});
    
    connector.execute({json.dumps(step)}, {json.dumps(constraints)})
      .then(r => console.log(JSON.stringify(r)))
      .catch(e => {{ console.error(e); process.exit(1); }});
    """
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True)
    return json.loads(result.stdout)
```

### Extension Bridge Pattern

```typescript
// glazyr-extension/src/connectors/playwright-bridge.ts
import { PlaywrightConnector } from '../../mcp/connectors/dist';

export async function executePlaywrightStep(step, constraints) {
  const connector = new PlaywrightConnector({ headless: false });
  
  // Resolve text_ref from extension storage
  if (step.input.text_ref) {
    const stored = await chrome.storage.local.get(`secure_${step.input.text_ref}`);
    step.input.text = stored[`secure_${step.input.text_ref}`];
  }
  
  return await connector.execute(step, constraints);
}
```

## Security Considerations

### Google Places (Server-Side)
- ✅ API keys stored in server environment/secrets
- ✅ No client-side key exposure
- ✅ Rate limiting enforced server-side
- ✅ Field minimization enforced

### Playwright (Client-Side)
- ✅ Runs in user's local environment
- ✅ No network exposure of browser automation
- ✅ Local policy enforcement
- ✅ Secure vault for text references (extension storage)
- ✅ Human approval gates for high-risk actions

## Testing Strategy

### Google Places Tool
1. Test Python bridge calls TypeScript connector
2. Test LangChain tool binding
3. Test agent uses tool correctly
4. Test MCP endpoint returns results

### Playwright Bridge
1. Test extension bridge initializes connector
2. Test text reference resolution
3. Test approval flow for high-risk actions
4. Test result reporting back to agent

## Dependencies

### glazyr-control (Python)
- ✅ `langchain` (already installed)
- ✅ `langchain-openai` (already installed)
- ⚠️ May need `langchain-core` for Tool class (check version)

### glazyr-extension (TypeScript)
- ✅ Playwright connector (already built)
- ⚠️ Need to bundle connector for extension (webpack/rollup)

### mcp/connectors (TypeScript)
- ✅ All dependencies installed
- ✅ Compiled to `dist/` directory

## Open Questions

1. **Tool Discovery**: Should agent auto-discover tools from MCP manifest, or explicitly bind?
   - **Recommendation**: Explicit binding (more control, clearer)

2. **Playwright Communication**: How should agent communicate Playwright instructions to extension?
   - **Option A**: Agent returns instruction in response, extension polls
   - **Option B**: Extension subscribes to agent responses
   - **Recommendation**: Option A (simpler, existing pattern)

3. **Error Handling**: How to handle Playwright errors when extension executes?
   - **Recommendation**: Extension reports errors back to agent, agent handles gracefully

4. **State Management**: How to maintain Playwright browser session across agent turns?
   - **Recommendation**: Extension maintains session, agent sends step-by-step instructions

## Next Steps

1. **Review this document** with team
2. **Decide on tool binding approach** (function calling vs agent executor)
3. **Implement Google Places bridge** (server-side)
4. **Test LangChain tool integration**
5. **Implement Playwright bridge** (extension)
6. **Test end-to-end flow**

## References

- [LANGCHAIN_INTEGRATION.md](./LANGCHAIN_INTEGRATION.md) - Detailed LangChain integration guide
- [ARCHITECTURE_INTEGRATION.md](./ARCHITECTURE_INTEGRATION.md) - Architecture integration patterns
- [USAGE_GUIDE.md](./USAGE_GUIDE.md) - Complete usage examples
- [QUICK_INTEGRATION_GUIDE.md](./QUICK_INTEGRATION_GUIDE.md) - Quick reference

## Conclusion

The MCP connectors should be integrated as **MCP tools in glazyr-control**, with:
- **Google Places** as a server-side LangChain tool
- **Playwright** executed locally in the extension
- **Explicit tool binding** required for LangChain detection
- **Python bridges** to call TypeScript connectors
- **Extension bridges** for local Playwright execution

This architecture maintains security, enables agent tool usage, and follows the existing MCP pattern.



