# Quick Test - Valuation MCP Integration

## What You Need

1. OpenAI API key
2. PowerShell terminal
3. 2 minutes

## Step-by-Step

### 1. Open PowerShell and navigate to glazyr-control

```powershell
cd C:\Users\senti\OneDrive\Desktop\glazyr\glazyr-control
```

### 2. Set your OpenAI API key

```powershell
$env:OPENAI_API_KEY = "sk-your-key-here"
```

### 3. Start the server

```powershell
& .\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8012
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8012
```

**Keep this terminal open!**

### 4. Open a NEW PowerShell window and test

```powershell
# Test 1: Check if server is running
Invoke-WebRequest -Uri "http://127.0.0.1:8012/healthz" -UseBasicParsing

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
```

### 5. What to expect

If it works, you'll see:
- The agent responds with analysis of the repository
- The response includes metrics, scores, and development activity
- No errors about "tool not found"

If it doesn't work:
- Check the server terminal for errors
- Make sure OpenAI API key is set correctly
- Verify the Valuation MCP server is accessible

## That's It!

If the test works, the integration is complete and ready to use. The tools will automatically be available:
- ✅ Through the extension (when configured)
- ✅ Through the website (when configured)
- ✅ Through direct API calls

No further changes needed!
