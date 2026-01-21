# Testing Valuation MCP Routing

Quick test to verify `/valuation` prefix routes to the hosted Valuation MCP server.

## Quick Test

### 1. Start glazyr-control Server

```powershell
cd C:\Users\senti\OneDrive\Desktop\glazyr\glazyr-control

# Set OpenAI API key (required for local agent, not for routing)
$env:OPENAI_API_KEY = "sk-..."

# Optional: Override Valuation MCP URL if needed
# $env:VALUATION_MCP_URL = "https://valuation-mcp-server-554655392699.us-central1.run.app"

# Start server
& .\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8012
```

### 2. Test Valuation Routing

```powershell
# Test 1: Route to Valuation MCP with /valuation prefix
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "/valuation analyze the langchain-ai/langchain repository"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected:** Response from Valuation MCP server with repository analysis.

### 3. Test LangChain Routing (Optional)

```powershell
# Test 2: Route to LangChain MCP with /langchain prefix
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "/langchain explain this Python code"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

### 4. Test Default (No Routing)

```powershell
# Test 3: No prefix - uses local agent
$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "What is Python?"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8012/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## What to Look For

### ✅ Success Indicators

1. **Valuation routing works:**
   - `/valuation` prefix is detected
   - Request is forwarded to Valuation MCP server
   - Response contains repository analysis data
   - No errors about "Target MCP server URL not configured"

2. **Response format:**
   ```json
   {
     "task_id": "...",
     "request_id": "...",
     "output": "...analysis results...",
     "result": "...analysis results..."
   }
   ```

### ❌ Error Indicators

1. **"Target MCP server URL not configured"**
   - Check `VALUATION_MCP_URL` environment variable
   - Default should be: `https://valuation-mcp-server-554655392699.us-central1.run.app`

2. **"Request to MCP server timed out"**
   - Valuation MCP server might be slow
   - Check network connectivity
   - Verify server is accessible

3. **"MCP server error: ..."**
   - Check Valuation MCP server logs
   - Verify the query format is correct

## Complete Test Script

```powershell
# Complete test script
$baseUrl = "http://127.0.0.1:8012"

Write-Host "`n=== Test 1: Valuation Routing ===" -ForegroundColor Cyan
$valuationBody = @{
    tool = "agent_executor"
    inputs = @{
        input = "/valuation analyze the langchain-ai/langchain repository"
    }
} | ConvertTo-Json

$result = Invoke-WebRequest -Uri "$baseUrl/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $valuationBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host $result

# Check if it worked
$json = $result | ConvertFrom-Json
if ($json.output -or $json.result) {
    Write-Host "`n✅ Valuation routing works!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Valuation routing failed" -ForegroundColor Red
    Write-Host "Error: $($json.error)" -ForegroundColor Red
}
```

## Testing via Extension

Once routing works via API, test in extension:

1. **Start glazyr-control server** (as above)
2. **Configure extension** to use `http://127.0.0.1:8012`
3. **In extension widget**, type:
   ```
   /valuation analyze the langchain-ai/langchain repository
   ```
4. **Should route** to Valuation MCP server and return results

## Troubleshooting

### Check Configuration

```powershell
# Verify environment variables are set
$env:VALUATION_MCP_URL
$env:LANGCHAIN_MCP_URL
```

### Test Valuation MCP Server Directly

```powershell
# Test Valuation MCP server is accessible
Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/health" -UseBasicParsing
```

### Check Server Logs

Watch the glazyr-control server terminal for:
- Routing detection messages
- Proxy request logs
- Error messages

## Summary

- ✅ `/valuation` prefix routes to hosted Valuation MCP server
- ✅ No extension changes needed
- ✅ Works with single glazyr-control URL
- ✅ Default behavior unchanged (no prefix = local agent)
