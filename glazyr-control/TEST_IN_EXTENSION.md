# Testing Slash Commands in Extension

Test `/valuation` and `/langchain` routing directly in the Chrome extension.

## Setup

### 1. Start glazyr-control Server

```powershell
cd C:\Users\senti\OneDrive\Desktop\glazyr\glazyr-control

# Set OpenAI API key
$env:OPENAI_API_KEY = "sk-..."

# Start server
& .\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8012
```

**Keep this terminal open!**

### 2. Configure Extension

1. **Load extension** in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `glazyr-extension/dist` folder

2. **Set MCP Runtime URL**:
   - Open the extension widget/popup
   - Type: `/runtime url http://127.0.0.1:8012`
   - Press Enter

   You should see: "Runtime URL set."

## Test Commands

### Test 1: `/valuation` Command

1. **Open any webpage** (or GitHub)
2. **Open Glazyr widget** (click extension icon or use keyboard shortcut)
3. **Type in the chat:**
   ```
   /valuation analyze the langchain-ai/langchain repository
   ```
4. **Press Enter**

**Expected:**
- Query is sent to glazyr-control
- glazyr-control detects `/valuation` prefix
- Routes to Valuation MCP server
- Returns repository analysis

### Test 2: `/langchain` Command

1. **In extension widget, type:**
   ```
   /langchain explain what Python decorators are
   ```
2. **Press Enter**

**Expected:**
- Routes to LangChain MCP server
- Returns explanation

### Test 3: Default (No Prefix)

1. **In extension widget, type:**
   ```
   What is Python?
   ```
2. **Press Enter**

**Expected:**
- Uses local glazyr-control agent
- No routing (uses integrated tools)

## Example Queries to Test

### Valuation Queries

```
/valuation analyze the microsoft/vscode repository
```

```
/valuation calculate the valuation of langchain-ai/langchain using cost-based method
```

```
/valuation compare the langchain-ai/langchain repository with similar projects in the mcp-server category
```

### LangChain Queries

```
/langchain explain this code: def hello(): print("world")
```

```
/langchain write a Python function to calculate fibonacci numbers
```

### Default Queries (No Prefix)

```
Find coffee shops near me
```

```
What is the weather like?
```

## What to Look For

### ✅ Success Indicators

1. **Valuation routing:**
   - Query with `/valuation` prefix
   - Response contains repository analysis/valuation data
   - No errors

2. **LangChain routing:**
   - Query with `/langchain` prefix
   - Response from LangChain MCP server
   - No errors

3. **Default behavior:**
   - Query without prefix
   - Uses local agent
   - Works as before

### ❌ Error Indicators

1. **"MCP runtime not configured"**
   - Make sure you set `/runtime url http://127.0.0.1:8012`
   - Check glazyr-control server is running

2. **"Target MCP server URL not configured"**
   - Check environment variables in glazyr-control
   - Default URLs should be set in config.py

3. **Timeout errors**
   - Valuation MCP server might be slow
   - Check network connectivity

## Debugging

### Check Extension Console

1. Open Chrome DevTools (F12)
2. Go to "Console" tab
3. Look for errors or logs from extension

### Check glazyr-control Logs

Watch the server terminal for:
- Routing detection: "Detected /valuation prefix"
- Proxy requests: "Proxying to Valuation MCP server"
- Errors: Any error messages

### Verify Routing is Working

You can add temporary logging in `mcp.py`:

```python
# In _detect_routing_prefix function
print(f"Query: {query}, Detected prefix: {target_mcp}")
```

## Quick Test Checklist

- [ ] glazyr-control server running on port 8012
- [ ] Extension loaded and configured with `/runtime url http://127.0.0.1:8012`
- [ ] Test `/valuation` command - should route to Valuation MCP
- [ ] Test `/langchain` command - should route to LangChain MCP
- [ ] Test default query (no prefix) - should use local agent
- [ ] All commands return responses (no errors)

## Summary

✅ **Extension supports slash commands:**
- `/valuation` → Routes to Valuation MCP server
- `/langchain` → Routes to LangChain MCP server
- No prefix → Uses local glazyr-control agent

✅ **No extension code changes needed:**
- Extension just sends queries to glazyr-control
- glazyr-control handles routing based on prefixes

✅ **Works immediately:**
- Just configure extension to point to your glazyr-control server
- Start using slash commands!
