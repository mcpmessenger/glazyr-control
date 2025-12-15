# glazyr-control

MCP-native FastAPI runtime for Glazyr's AI agent orchestration. This service handles reasoning, tool orchestration, and task state management while keeping execution isolated in the Chrome extension.

## Overview

`glazyr-control` is the "intelligent runtime" that:
- Receives queries from the Chrome extension (with page context + vision-derived text)
- Orchestrates AI agent workflows via LangChain
- Enforces safety policies (API key auth, payload limits, domain allowlisting)
- Persists task summaries (text-only, no raw screenshots) for monitoring
- Exposes MCP-compatible endpoints for tool discovery and invocation

**Key principle**: Extension executes, Control plane monitors, Runtime orchestrates.

## Architecture

```
┌─────────────────┐
│ Chrome Extension │
│  (background.js) │
└────────┬─────────┘
         │
         └─→ glazyr-control (this service)
             POST /mcp/invoke
             GET  /api/tasks/{id}

┌─────────────────┐
│  Control Plane  │
│  (glazyr-main)  │
└────────┬─────────┘
         │
         └─→ glazyr-control
             GET  /api/runtime/tasks
             GET  /api/runtime/tasks/{id}
```

## Endpoints

### MCP Endpoints

- **`GET /mcp/manifest`** - List available tools (returns `agent_executor` tool schema)
- **`POST /mcp/invoke`** - Invoke agent with query
  - Request: `{ "tool": "agent_executor", "arguments": { "query": "...", "task_id": "..." } }`
  - Response: `{ "content": [{ "type": "text", "text": "..." }] }`

### Monitoring Endpoints

- **`GET /api/tasks`** - List recent task summaries (query param: `limit`, default 25)
- **`GET /api/tasks/{task_id}`** - Get specific task summary
- **`GET /healthz`** - Health check

### Task Summaries

Task summaries are **safe, text-only** records:
- No raw screenshots or base64 data
- Only text previews and SHA256 hashes for verification
- Stored in Redis (if configured) or in-memory (fallback)

## Local Development

### Prerequisites

- Python 3.11+
- OpenAI API key (or AWS Secrets Manager ARN)

### Setup

```powershell
cd glazyr-control

# Create virtual environment
py -m venv .venv

# Install dependencies
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Set OpenAI API key (required)
$env:OPENAI_API_KEY = "sk-..."   # DO NOT commit this

# Optional: Set Redis URL for persistence
$env:REDIS_URL = "redis://localhost:6379/0"

# Optional: Configure policy settings
$env:GLAZYR_API_KEY = "your-client-access-key"  # If you want API key auth
$env:GLAZYR_MAX_PAYLOAD_SIZE_MB = "5"           # Default: 5MB
$env:GLAZYR_ALLOWED_DOMAINS = "example.com,api.example.com"  # Comma-separated
```

### Run

```powershell
& .\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8012
```

Test:
- Health: `http://127.0.0.1:8012/healthz`
- Manifest: `http://127.0.0.1:8012/mcp/manifest`
- Invoke: `POST http://127.0.0.1:8012/mcp/invoke` with JSON body

## AWS Deployment (Lambda Function URL) ⭐ Recommended

**For detailed Lambda deployment instructions, see [LAMBDA_DEPLOYMENT.md](./LAMBDA_DEPLOYMENT.md)**

### Quick Deploy

```powershell
cd glazyr-control

# 1. Create OpenAI key secret
aws secretsmanager create-secret `
  --name glazyr-control/openai-api-key `
  --secret-string "sk-..." `
  --region us-east-1

# 2. Deploy
.\deploy-sam.ps1 `
  -Region us-east-1 `
  -Stage dev `
  -OpenAIKeySecretArn "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:glazyr-control/openai-api-key-XXXXX"

# The script outputs the Function URL - use this in your extension!
```

### Environment Variables (SAM Parameters)

- **`OpenAIKeySecretArn`** (required): AWS Secrets Manager ARN for OpenAI API key
- **`ApiKey`** (optional): Client access key (enforces `x-glazyr-api-key` header)
- **`MaxPayloadSizeMB`** (optional, default: 5): Max request body size
- **`AllowedDomains`** (optional): Comma-separated domain allowlist
- **`RedisUrl`** (optional): Redis connection string for task persistence

### Update Function URL in Control Plane

After deployment, set this in your Next.js server environment:

```bash
GLAZYR_CONTROL_RUNTIME_URL=https://xxxxx.lambda-url.us-east-1.on.aws
GLAZYR_CONTROL_RUNTIME_API_KEY=your-client-access-key  # if configured
```

## Configuration

### Policy Settings

Configure via environment variables (local) or SAM parameters (AWS):

- **`GLAZYR_API_KEY`**: Enables API key authentication (header: `x-glazyr-api-key` or `Authorization: Bearer ...`)
- **`GLAZYR_MAX_PAYLOAD_SIZE_MB`**: Max request body size (default: 5MB)
- **`GLAZYR_ALLOWED_DOMAINS`**: Comma-separated domain allowlist (blocks non-whitelisted URLs in invokes)

### State Persistence

- **Redis** (recommended for production): Set `REDIS_URL` env var
- **In-memory** (default): Falls back to dict if Redis unavailable (lost on restart)

### OpenAI Configuration

- **Local**: Set `OPENAI_API_KEY` env var
- **AWS**: Set `OPENAI_API_KEY_SECRET_ARN` SAM parameter (loads from Secrets Manager)

## Extension Integration

The Chrome extension calls `glazyr-control` via:

1. **Default MCP URL**: Hardcoded in `glazyr-extension/dist/background.js` as `DEFAULT_MCP_RUNTIME_BASE_URL`
2. **User configuration**: Via slash commands:
   ```
   /runtime url https://your-glazyr-control-url
   /runtime key your-api-key
   /runtime show
   ```

See `HANDOFF_INSTRUCTIONS.md` in the root repo for full integration details.

## Control Plane Integration

The Next.js control plane (`glazyr-main`) proxies requests to `glazyr-control` via:

- `/api/runtime/mcp/manifest` → `GET {RUNTIME}/mcp/manifest`
- `/api/runtime/mcp/invoke` → `POST {RUNTIME}/mcp/invoke`
- `/api/runtime/tasks` → `GET {RUNTIME}/api/tasks`
- `/api/runtime/tasks/[taskId]` → `GET {RUNTIME}/api/tasks/{task_id}`

See `glazyr-main/lib/api/runtime.ts` for client helpers.

## Error Handling

- **Retries**: Agent invocations retry up to 3 times with exponential backoff (via `tenacity`)
- **Errors**: Standardized MCP-shaped responses: `{ "error": "details" }`
- **Validation**: 422 for invalid requests, 403 for policy violations, 401 for auth failures

## Security

- **API Key Auth**: Optional but recommended for production
- **Payload Limits**: Prevents abuse (default 5MB)
- **Domain Allowlisting**: Restricts outbound URLs in agent invokes
- **Secrets Manager**: Secure storage for provider keys (AWS)
- **No Raw Data**: Task summaries never include screenshots/base64

## Troubleshooting

### `OPENAI_API_KEY is not set`

- **Local**: Set `$env:OPENAI_API_KEY` in the same PowerShell session before starting `uvicorn`
- **AWS**: Ensure `OpenAIKeySecretArn` SAM parameter is set and the secret exists

### `422 Unprocessable Content`

- Check request body format (must include `tool` and `arguments`)
- Verify payload size is under limit

### `403 Forbidden`

- Check API key header if auth is enabled
- Verify domain allowlist if URL validation is enabled

### Port already in use

```powershell
# Find process on port 8012
Get-NetTCPConnection -LocalPort 8012 | Select-Object -ExpandProperty OwningProcess

# Kill it
Stop-Process -Id <PID>
```

## Next Steps

- **Add more tools**: Extend `mcp_manifest()` in `src/mcp.py`
- **Customize agent**: Modify `execute_agent()` in `src/agent.py`
- **LangGraph integration**: Add `langgraph` for complex workflow branching
- **Playwright automation**: Add browser automation tools (wrap in MCP)

## See Also

- **Lambda Deployment Guide**: `LAMBDA_DEPLOYMENT.md` - Complete AWS Lambda deployment instructions
- **Production Deployment**: `PRODUCTION_DEPLOYMENT.md` - Comparison of deployment options
- **Root README**: `../README.md` (monorepo overview)
- **Handoff Instructions**: `../HANDOFF_INSTRUCTIONS.md` (team integration guide)
- **Extension README**: `../glazyr-extension/README.md`
- **Control Plane README**: `../glazyr-main/README.md`
