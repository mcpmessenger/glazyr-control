# Testing the Valuation MCP Integration

## Quick Answer

**No extension or website updates needed!** The tools are automatically available through the agent. The extension and website already communicate with `glazyr-control` via the `/mcp/invoke` endpoint, and the agent will automatically use the valuation tools when appropriate.

## Testing Methods

### Method 1: Direct Python Testing (Recommended for Development)

Test the bridge and tools directly:

```powershell
cd glazyr-control
& .\.venv\Scripts\python.exe
```

```python
# Test 1: Test the bridge directly
from src.connectors.valuation_mcp import get_valuation_mcp_bridge

bridge = get_valuation_mcp_bridge()
result = bridge.analyze_repository(owner="langchain-ai", repo="langchain")
print(result)

# Test 2: Test via LangChain tool
from src.tools.valuation_tools import analyze_github_repository_tool

result = analyze_github_repository_tool.invoke({
    "owner": "langchain-ai",
    "repo": "langchain"
})
print(result)
```

### Method 2: Test via MCP Invoke Endpoint (Production-like)

Start the server:

```powershell
cd glazyr-control
$env:OPENAI_API_KEY = "sk-..."  # Your OpenAI API key
& .\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8012
```

Test with curl/PowerShell:

```powershell
# Test 1: Check manifest (should show agent_executor tool)
Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/manifest" -UseBasicParsing | Select-Object -ExpandProperty Content

# Test 2: Ask agent to analyze a repository
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "Analyze the langchain-ai/langchain repository"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content

# Test 3: Ask agent to calculate valuation
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "Analyze the langchain-ai/langchain repository and calculate its valuation using cost-based method"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Method 3: Test via Extension (End-to-End)

1. **Start glazyr-control server** (see Method 2)
2. **Configure extension** to point to your local server:
   - Open extension popup
   - Set MCP runtime URL to `http://127.0.0.1:8012`
3. **Test in extension**:
   - Open any webpage
   - Ask: "Analyze the langchain-ai/langchain repository"
   - The agent should automatically use the `analyze_github_repository` tool

### Method 4: Test via Website (Full Stack)

1. **Start glazyr-control server** (see Method 2)
2. **Configure glazyr-main** to proxy to your local server:
   - Set `GLAZYR_CONTROL_RUNTIME_URL=http://127.0.0.1:8012` in `.env.local`
   - Start glazyr-main: `cd glazyr-main && npm run dev`
3. **Test via website**:
   - The website proxies requests to glazyr-control
   - Tools are automatically available through the agent

## Expected Behavior

### When tools work correctly:

1. **Agent receives query** about analyzing/valuing a repository
2. **Agent detects** it needs to use valuation tools
3. **Agent calls** `analyze_github_repository_tool` (or other valuation tools)
4. **Tool executes** via bridge → Valuation MCP server
5. **Results returned** to agent, formatted for user

### Example Flow:

```
User: "Analyze the langchain-ai/langchain repository"

Agent thinks: "I need to analyze a GitHub repository. I have the analyze_github_repository tool."

Agent calls: analyze_github_repository_tool.invoke({
    "owner": "langchain-ai",
    "repo": "langchain"
})

Tool → Bridge → Valuation MCP Server → Results

Agent: "Here's the analysis of the langchain repository: [results]"
```

## Troubleshooting

### Issue: "Tool not found" or agent doesn't use tools

**Check:**
1. Tools are imported in `agent.py`:
   ```python
   from .tools.valuation_tools import (
       analyze_github_repository_tool,
       calculate_valuation_tool,
       compare_with_market_tool,
   )
   ```
2. Tools are registered in `_get_tools()`:
   ```python
   tools.extend([
       analyze_github_repository_tool,
       calculate_valuation_tool,
       compare_with_market_tool,
   ])
   ```
3. Server restarted after changes

### Issue: "Connection error" or timeout

**Check:**
1. Valuation MCP server is accessible:
   ```powershell
   Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/health" -UseBasicParsing
   ```
2. Network connectivity
3. Server URL is correct (defaults to production URL)

### Issue: Agent doesn't recognize when to use tools

**Solution:** The agent should automatically detect based on:
- Keywords: "analyze repository", "valuation", "compare with market"
- Context: GitHub repository mentions

If it doesn't work, try being more explicit:
- "Use the analyze_github_repository tool to analyze langchain-ai/langchain"
- "Calculate the valuation of this repository"

## Verification Checklist

- [ ] Bridge can connect to Valuation MCP server
- [ ] Tools can be imported without errors
- [ ] Tools are registered in `_get_tools()`
- [ ] Agent can use tools when appropriate
- [ ] Results are formatted correctly
- [ ] Error handling works (test with invalid repo)
- [ ] Telemetry is logged correctly

## Next Steps

Once testing is complete:
1. Tools are automatically available in production
2. No deployment changes needed (tools are part of glazyr-control)
3. Users can immediately start using valuation features through natural language
