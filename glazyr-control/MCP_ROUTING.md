# MCP Routing Support

## Overview

`glazyr-control` now supports routing queries to different MCP servers based on command prefixes:
- `/langchain` → Routes to LangChain MCP server
- `/valuation` → Routes to Valuation MCP server
- No prefix → Uses local agent (with all integrated tools)

## How It Works

### Architecture

```
Extension → glazyr-control → [Routing Logic]
                              ├─ /langchain → LangChain MCP Server
                              ├─ /valuation → Valuation MCP Server  
                              └─ (no prefix) → Local Agent (with valuation tools)
```

### Usage

**Route to LangChain MCP:**
```
/langchain analyze this code
```

**Route to Valuation MCP:**
```
/valuation analyze the langchain-ai/langchain repository
```

**Use Local Agent (default):**
```
Analyze the langchain-ai/langchain repository
```

## Configuration

Set environment variables to configure the MCP server URLs:

```powershell
# LangChain MCP Server URL
$env:LANGCHAIN_MCP_URL = "https://langchain-agent-mcp-server-554655392699.us-central1.run.app"

# Valuation MCP Server URL
$env:VALUATION_MCP_URL = "https://valuation-mcp-server-554655392699.us-central1.run.app"
```

**Defaults:**
- `LANGCHAIN_MCP_URL`: `https://langchain-agent-mcp-server-554655392699.us-central1.run.app`
- `VALUATION_MCP_URL`: `https://valuation-mcp-server-554655392699.us-central1.run.app`

## Examples

### Example 1: Route to LangChain MCP

**User query:**
```
/langchain explain this Python code
```

**What happens:**
1. Extension sends query to `glazyr-control`
2. `glazyr-control` detects `/langchain` prefix
3. Removes prefix: `explain this Python code`
4. Proxies to LangChain MCP server
5. Returns response to extension

### Example 2: Route to Valuation MCP

**User query:**
```
/valuation calculate the valuation of langchain-ai/langchain using cost-based method
```

**What happens:**
1. Extension sends query to `glazyr-control`
2. `glazyr-control` detects `/valuation` prefix
3. Removes prefix: `calculate the valuation of langchain-ai/langchain using cost-based method`
4. Proxies to Valuation MCP server
5. Returns response to extension

### Example 3: Use Local Agent (Default)

**User query:**
```
Analyze the langchain-ai/langchain repository
```

**What happens:**
1. Extension sends query to `glazyr-control`
2. No prefix detected
3. Uses local agent with integrated tools (including valuation tools)
4. Agent automatically uses `analyze_github_repository_tool`
5. Returns response to extension

## Benefits

1. **Flexibility**: Choose which MCP server to use per query
2. **Backward Compatible**: Default behavior unchanged (uses local agent)
3. **No Extension Changes**: Extension still uses single URL (`glazyr-control`)
4. **Best of Both Worlds**: Can use specialized MCP servers when needed, or local agent with integrated tools

## When to Use Each

### Use `/langchain` when:
- You want to use the standalone LangChain MCP server
- You need specific LangChain features not in glazyr-control

### Use `/valuation` when:
- You want to use the standalone Valuation MCP server directly
- You need specific valuation features

### Use default (no prefix) when:
- You want the integrated experience
- You want glazyr-control's agent to automatically choose tools
- You want all tools (Google Places, Valuation, etc.) available automatically

## Technical Details

### Routing Detection

The routing logic:
1. Checks if query starts with `/langchain` or `/valuation`
2. Removes the prefix (including space after)
3. Returns cleaned query and target MCP URL
4. If no prefix, returns original query and `None` (uses local agent)

### Proxy Function

When routing is detected:
1. Forwards request to target MCP server's `/mcp/invoke` endpoint
2. Maintains task_id and request_id for tracing
3. Returns response in MCP-compatible format
4. Handles errors gracefully

## Testing

### Test LangChain Routing

```powershell
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "/langchain explain this code"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Test Valuation Routing

```powershell
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "/valuation analyze the langchain-ai/langchain repository"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Test Default (Local Agent)

```powershell
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "Analyze the langchain-ai/langchain repository"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Summary

- ✅ **Extension unchanged**: Still uses single `glazyr-control` URL
- ✅ **Routing support**: `/langchain` and `/valuation` prefixes route to different servers
- ✅ **Default behavior**: No prefix uses local agent with integrated tools
- ✅ **Flexible**: Choose the right tool for each query
- ✅ **Backward compatible**: Existing queries work as before
