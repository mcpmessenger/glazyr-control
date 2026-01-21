# Testing Valuation MCP Integration via Extension

## Architecture Overview

```
User (You) 
  ↓
Extension (Cockpit - Widget UI)
  ↓
glazyr-control (Agent with Valuation Tools)
  ↓
Valuation MCP Server
```

## Setup Steps

### 1. Start glazyr-control Server

```powershell
cd C:\Users\senti\OneDrive\Desktop\glazyr\glazyr-control

# Set OpenAI API key
$env:OPENAI_API_KEY = "sk-your-key-here"

# Start server
& .\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8012
```

**Keep this terminal open!** The server must be running.

### 2. Configure Extension to Use Your Local Server

1. **Load the extension** in Chrome:
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `glazyr-extension/dist` folder

2. **Set MCP Runtime URL**:
   - Open the extension popup/widget
   - Look for settings/configuration
   - Set MCP Runtime URL to: `http://127.0.0.1:8012`
   - Save configuration

   **OR** if the extension uses commands:
   - Type in the extension: `/runtime url http://127.0.0.1:8012`

### 3. Test in Extension

1. **Open any webpage** (or GitHub)
2. **Open the Glazyr widget/popup** (usually a button or icon)
3. **Ask a question** in the chat:

   ```
   Analyze the langchain-ai/langchain repository
   ```

4. **The agent will automatically**:
   - Detect you want to analyze a repository
   - Use the `analyze_github_repository` tool
   - Call the Valuation MCP server
   - Return formatted results

## Example Queries to Test

### Test 1: Analyze Repository
```
Analyze the langchain-ai/langchain repository
```

### Test 2: Calculate Valuation
```
Analyze the langchain-ai/langchain repository and calculate its valuation using cost-based method
```

### Test 3: Compare with Market
```
How does the langchain-ai/langchain repository compare to similar projects in the langchain category?
```

### Test 4: Full Workflow
```
Analyze the microsoft/vscode repository, calculate its valuation using market-based method, and compare it with similar projects
```

## What Happens Behind the Scenes

1. **You type** in extension widget: "Analyze the langchain-ai/langchain repository"

2. **Extension sends** to glazyr-control:
   ```json
   {
     "tool": "agent_executor",
     "inputs": {
       "input": "Analyze the langchain-ai/langchain repository"
     }
   }
   ```

3. **Agent in glazyr-control**:
   - Receives your query
   - Detects it needs to analyze a repository
   - Automatically calls `analyze_github_repository_tool`
   - Tool calls bridge → Valuation MCP server
   - Gets results back

4. **Agent formats** and returns response to extension

5. **Extension displays** the analysis in the widget

## Troubleshooting

### Extension says "MCP not configured"
- Make sure glazyr-control server is running
- Check the MCP Runtime URL is set correctly: `http://127.0.0.1:8012`
- Verify the server is accessible (test with browser: `http://127.0.0.1:8012/healthz`)

### Agent doesn't use valuation tools
- Check server logs for errors
- Verify tools are registered (check `agent.py` `_get_tools()` function)
- Try being more explicit: "Use the analyze_github_repository tool to analyze langchain-ai/langchain"

### Connection errors
- Make sure glazyr-control server is running on port 8012
- Check firewall isn't blocking localhost
- Verify OpenAI API key is set correctly

### No response from agent
- Check glazyr-control server terminal for errors
- Verify Valuation MCP server is accessible
- Check OpenAI API key is valid

## Verification

When it works, you should see:
- ✅ Agent responds with repository analysis
- ✅ Results include metrics, scores, development activity
- ✅ No errors about "tool not found"
- ✅ Response is formatted and readable

## Next Steps

Once testing works:
- ✅ Integration is complete
- ✅ Tools are automatically available
- ✅ Users can ask natural language questions
- ✅ No code changes needed

The extension is your **cockpit** - this is where users will interact with the agent, and the agent will automatically use the valuation tools when appropriate!
