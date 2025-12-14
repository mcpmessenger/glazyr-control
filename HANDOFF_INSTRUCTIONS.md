# Handoff Instructions: glazyr-control MCP Runtime Integration

**Date:** December 13, 2025  
**Status:** ✅ Control plane wired, Extension ready, Runtime deployed

---

## For Extension Dev Team

### What's Already Done

✅ **Extension is wired** to call LangChain Agents MCP runtime:
- Default MCP URL: `https://langchain-agent-mcp-server-554655392699.us-central1.run.app`
- Format: Uses LangChain agents MCP format (`arguments: { query: ... }`)
- Response parsing: Handles `{ content: [{ type: "text", text: "..." }] }` format
- Error handling: Graceful fallbacks for 404s, 422s, etc.

### Extension Configuration

Users can configure the MCP runtime via slash commands in the widget:

```
/runtime url https://your-mcp-url-here
/runtime key your-api-key-here
/runtime show
```

Or via `chrome.storage.local`:
- `glazyrMcpRuntimeBaseUrl`: MCP runtime base URL
- `glazyrMcpRuntimeApiKey`: Optional API key

### MCP Endpoints Used

- **`GET /mcp/manifest`** - List available tools
- **`POST /mcp/invoke`** - Invoke agent with query
- **`GET /api/tasks/{task_id}`** - Poll task status (optional; gracefully handles 404)

### Request Format

```json
{
  "tool": "agent_executor",
  "arguments": {
    "query": "User query + page context + derived vision text"
  }
}
```

### What You Need to Do

**Nothing required** - the extension is already configured and working. If you want to:

1. **Change the default MCP URL**: Edit `DEFAULT_MCP_RUNTIME_BASE_URL` in `glazyr-extension/dist/background.js`
2. **Add more slash commands**: Extend the `/` command handler in `background.js`
3. **Customize response formatting**: Modify `extractMcpResponseText()` in `background.js`

---

## For Website Dev Team (glazyr-main)

### What's Already Done

✅ **Control plane is wired** to proxy glazyr-control runtime:
- Proxy routes: `/api/runtime/mcp/manifest`, `/api/runtime/mcp/invoke`, `/api/runtime/tasks`, `/api/runtime/tasks/[taskId]`
- UI integration: Task history page shows "Runtime (glazyr-control)" section
- Client helpers: `lib/api/runtime.ts` with typed functions

### Required Environment Variables

Set these on your **Next.js server** (not browser env):

```bash
GLAZYR_CONTROL_RUNTIME_URL=https://your-glazyr-control-function-url.lambda-url.us-east-1.on.aws
GLAZYR_CONTROL_RUNTIME_API_KEY=your-client-access-key  # optional, if runtime requires auth
```

### What You Need to Do

**Nothing required** - the wiring is complete. If you want to:

1. **Deploy glazyr-control to AWS**: Run `glazyr-control/deploy-sam.ps1` (see `glazyr-control/README.md`)
2. **Set env vars**: Add the runtime URL + optional API key to your Next.js deployment
3. **Customize UI**: The runtime task section is in `app/dashboard/task-history/page.tsx`

### Using the Runtime Client

```typescript
import { listRuntimeTasks, getRuntimeTask } from "@/lib/api/runtime"

// List recent tasks
const { tasks } = await listRuntimeTasks(25)

// Get specific task
const { task } = await getRuntimeTask("task-id-here")
```

---

## For Backend Dev Team (glazyr-control)

### What's Already Done

✅ **glazyr-control is implemented** as a FastAPI microservice:
- MCP endpoints: `/mcp/manifest`, `/mcp/invoke`
- Monitoring: `/api/tasks`, `/api/tasks/{task_id}`
- AWS SAM deployment: `template.yaml` + `deploy-sam.ps1`
- Secrets Manager integration: Optional `OPENAI_API_KEY_SECRET_ARN`
- Policy middleware: API key auth, payload limits, domain allowlisting

### Deploy to AWS

```powershell
cd glazyr-control

# Create OpenAI key secret
aws secretsmanager create-secret `
  --name glazyr-control/openai-api-key `
  --secret-string "YOUR_OPENAI_KEY" `
  --region us-east-1

# Deploy (copy the ARN from above)
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:..." `
  -ApiKey "your-client-access-key"
```

The script prints the **Function URL** - use that as `GLAZYR_CONTROL_RUNTIME_URL` in the website.

### What You Need to Do

**Nothing required** - the runtime is ready. If you want to:

1. **Add more tools**: Extend `mcp_manifest()` in `src/mcp.py`
2. **Customize agent behavior**: Modify `execute_agent()` in `src/agent.py`
3. **Add Redis persistence**: Set `REDIS_URL` env var (currently falls back to in-memory)

---

## Architecture Summary

```
┌─────────────────┐
│ Chrome Extension│
│  (background.js) │
└────────┬─────────┘
         │
         ├─→ Vision Runtime (AWS Lambda)
         │   POST /runtime/vision/analyze
         │
         └─→ MCP Runtime (glazyr-control)
             POST /mcp/invoke
             GET  /api/tasks/{id}

┌─────────────────┐
│  Control Plane  │
│  (glazyr-main)  │
└────────┬─────────┘
         │
         └─→ MCP Runtime (glazyr-control)
             GET  /api/runtime/tasks
             GET  /api/runtime/tasks/{id}
```

**Key principle**: Extension executes, Control plane monitors/configures, Runtimes orchestrate.

---

## Testing Checklist

### Extension
- [ ] `/mcp/manifest` returns tool list
- [ ] `/mcp Hello` returns AI response
- [ ] `/runtime show` displays configured URL
- [ ] Normal queries route to MCP automatically

### Control Plane
- [ ] `/api/runtime/tasks` returns task list (requires auth if configured)
- [ ] Task history page shows "Runtime (glazyr-control)" section
- [ ] Runtime tasks display correctly

### Runtime (glazyr-control)
- [ ] Local dev: `http://127.0.0.1:8012/healthz` returns 200
- [ ] Local dev: `http://127.0.0.1:8012/mcp/manifest` returns tools
- [ ] AWS: Function URL works (if deployed)
- [ ] Secrets Manager: OpenAI key loads correctly (if configured)

---

## Questions?

- **Extension issues**: Check `glazyr-extension/README.md`
- **Control plane issues**: Check `glazyr-main/README.md`
- **Runtime issues**: Check `glazyr-control/README.md` (create if needed)
- **General**: See root `README.md`
