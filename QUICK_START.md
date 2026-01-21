# Quick Start Guide - Glazyr Implementation

This guide helps you get started with the newly implemented Google Places integration and Playwright bridge.

## Prerequisites

1. **Python Environment:**
   ```bash
   cd glazyr-control
   pip install -r requirements.txt
   ```

2. **TypeScript Connectors (compiled):**
   ```bash
   cd mcp/connectors
   npm install
   npm run build
   ```

3. **Environment Variables:**
   ```bash
   export OPENAI_API_KEY="your-openai-key"
   export GOOGLE_PLACES_API_KEY="your-google-places-key"
   # OR use secrets manager:
   export GOOGLE_PLACES_API_KEY_SECRET_ARN="arn:aws:secretsmanager:..."
   ```

## Testing the Google Places Integration

### 1. Direct Tool Invocation (via MCP endpoint)

```bash
curl -X POST http://localhost:8000/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "google_places_search",
    "input": {
      "query": "vegan restaurants near me",
      "location": {"lat": 41.58, "lng": -93.62},
      "radius_meters": 2000,
      "limit": 5
    }
  }'
```

### 2. Agent with Tools (via agent_executor)

```bash
curl -X POST http://localhost:8000/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "agent_executor",
    "input": {
      "input": "Find me the best rated coffee shops near Des Moines, Iowa"
    }
  }'
```

The agent will automatically use the `google_places_search` tool when appropriate.

### 3. Python Code Example

```python
from src.connectors.google_places import get_google_places_bridge

bridge = get_google_places_bridge()
result = bridge.search(
    query="coffee shops",
    location={"lat": 41.58, "lng": -93.62},
    radius_meters=2000,
    limit=5
)

if result.get("status") == "success":
    places = result.get("output", {}).get("results", [])
    for place in places:
        print(f"{place.get('name')} - Rating: {place.get('rating')}")
```

## Running the Server

```bash
cd glazyr-control
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

## Testing

Run the unit tests:

```bash
cd glazyr-control
python -m pytest tests/ -v
```

## Bridge Configuration

### Option 1: HTTP Bridge (Recommended for Production)

Start an HTTP server for the TypeScript connectors:

```typescript
// mcp/connectors/server.ts
import express from 'express';
import { GooglePlacesConnector } from './index';

const app = express();
app.use(express.json());

const connector = new GooglePlacesConnector({
  apiKeyRef: process.env.GOOGLE_PLACES_API_KEY
});

app.post('/google-places/execute', async (req, res) => {
  const { step, constraints } = req.body;
  const result = await connector.execute(step, constraints);
  res.json(result);
});

app.listen(3001);
```

Then set:
```bash
export MCP_CONNECTORS_HTTP_URL="http://localhost:3001"
```

### Option 2: Subprocess Bridge (Development)

Set the connector path:
```bash
export MCP_CONNECTORS_DIST="/path/to/mcp/connectors/dist"
```

## Extension Integration

The Playwright bridge is ready for integration. To use it:

1. **Compile the extension TypeScript files** (when build system is set up)
2. **Integrate the background handler** into your existing `background.js`
3. **Implement approval UI** for high-risk actions

Example message format:

```javascript
chrome.runtime.sendMessage({
  type: 'playwright_execute',
  request_id: 'uuid-v4',
  payload: {
    url: 'https://example.com/login',
    steps: [
      { type: 'goto', url: 'https://example.com/login' },
      { type: 'fill', selector: '#email', text_ref: 'vault_user_email' },
      { type: 'click', selector: '#submit' }
    ],
    constraints: {
      confirm_before_click: ['#delete-account'],
      timeout_seconds: 30
    }
  }
});
```

## Error Handling

All errors follow a standardized format:

```json
{
  "status": "error",
  "request_id": "uuid-v4",
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "meta": {}
}
```

Common error codes:
- `VALIDATION_ERROR` - Input validation failed
- `TOOL_ERROR_*` - Tool execution error
- `CONNECTOR_ERROR_*` - Connector error
- `TIMEOUT_ERROR` - Operation timed out
- `AUTH_ERROR` - Authentication failed

## Next Steps

1. **Set up HTTP bridge server** for TypeScript connectors
2. **Test end-to-end flow**: Agent → Tool → Connector → API
3. **Implement extension approval UI**
4. **Add telemetry/logging**
5. **Security review**

## Troubleshooting

### "Tool not found" error
- Ensure `google_places_search` is in the MCP manifest
- Check that the tool is properly registered

### "Connector execution failed"
- Verify API key is set correctly
- Check connector path/HTTP URL configuration
- Review connector logs

### Agent doesn't use tools
- Check that tools are bound to the LLM
- Verify tool descriptions are clear
- Ensure the query would benefit from tool use
