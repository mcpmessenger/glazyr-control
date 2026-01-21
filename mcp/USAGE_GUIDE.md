# MCP Connectors Usage Guide

This guide shows you how to use the Google Places and Playwright MCP connectors in your Glazyr application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Google Places Connector](#google-places-connector)
3. [Playwright Connector](#playwright-connector)
4. [Integration Patterns](#integration-patterns)
5. [From TypeScript/JavaScript](#from-typescriptjavascript)
6. [From Python (glazyr-control)](#from-python-glazyr-control)
7. [From Chrome Extension](#from-chrome-extension)
8. [Complete Examples](#complete-examples)

## Quick Start

### Installation

```bash
cd mcp/connectors
npm install
npx playwright install  # Already done, but good to know
```

### Basic Usage

```typescript
import { GooglePlacesConnector, PlaywrightConnector, PlaywrightPolicy } from './mcp/connectors';

// Google Places - Find businesses
const places = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF' // Resolved by secure vault
});

// Playwright - Browser automation
const playwright = new PlaywrightConnector(
  { headless: true },
  new PlaywrightPolicy()
);
```

## Google Places Connector

### Search for Places

```typescript
import { GooglePlacesConnector } from './mcp/connectors';

const connector = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF'
});

// Step 1: Create MCP step
const step = {
  step_id: 's1',
  action: 'places_search',
  input: {
    query: 'coffee shops near Union Square',
    location: 'San Francisco',
    radius_meters: 1500
  }
};

// Step 2: Define constraints
const constraints = {
  max_results: 10,
  fields: ['place_id', 'name', 'rating', 'address', 'opening_hours'],
  budget: { api_calls: 3 }
};

// Step 3: Dry run (safety check)
const dryRun = await connector.dryRun(step, constraints);
if (!dryRun.allowed) {
  console.error('Blocked:', dryRun.reason);
  return;
}

// Step 4: Execute
const result = await connector.execute(step, constraints);

if (result.status === 'success') {
  const places = result.output?.results;
  console.log('Found places:', places);
} else {
  console.error('Error:', result.error);
}
```

### Get Place Details

```typescript
const detailsStep = {
  step_id: 's2',
  action: 'place_details',
  input: {
    place_id: 'ChIJ...', // From search results
    fields: ['website', 'phone', 'opening_hours']
  }
};

const detailsResult = await connector.execute(detailsStep, constraints);
console.log('Place details:', detailsResult.output);
```

### Available Actions

- `places_search` - Search for places by query or location
- `place_details` - Get detailed information about a place
- `place_photos` - Get photo metadata
- `place_hours` - Get business hours
- `place_reviews` - Get review summaries

## Playwright Connector

### Read-Only Operations (Safe)

```typescript
import { PlaywrightConnector, PlaywrightPolicy } from './mcp/connectors';

const connector = new PlaywrightConnector(
  { headless: true, timeout: 30000 },
  new PlaywrightPolicy()
);

// Navigate to URL
const navigateStep = {
  step_id: 's1',
  action: 'open_url',
  input: { url: 'https://example.com' }
};

const constraints = {
  allowlist_domains: ['example.com'],
  budget: { max_steps: 10, max_time_ms: 30000 }
};

// Always dry run first
const dryRun = await connector.dryRun(navigateStep, constraints);
if (!dryRun.allowed) {
  console.error('Navigation blocked:', dryRun.reason);
  return;
}

const result = await connector.execute(navigateStep, constraints);

// Extract text
const extractStep = {
  step_id: 's2',
  action: 'extract_text',
  input: {} // Extracts all visible text
};

const extractResult = await connector.execute(extractStep, constraints);
console.log('Page text:', extractResult.output?.text);

// Take screenshot
const screenshotStep = {
  step_id: 's3',
  action: 'screenshot',
  input: { full_page: true }
};

const screenshotResult = await connector.execute(screenshotStep, constraints);
console.log('Screenshot hash:', screenshotResult.proof?.screenshot_hash);

// Cleanup
await connector.close();
```

### Write Operations (Requires Approval)

```typescript
// Type text (high risk - requires approval)
const typeStep = {
  step_id: 's4',
  action: 'type',
  input: {
    selector: '#email',
    text_ref: 'USER_EMAIL' // Reference to secure vault, not raw text
  },
  requires_human_approval: true // Must be set explicitly
};

const typeDryRun = await connector.dryRun(typeStep, constraints);
if (typeDryRun.requiresHumanApproval && !typeStep.requires_human_approval) {
  console.log('⚠️ Human approval required');
  // Show UI to user, wait for approval
  // Then set requires_human_approval: true and execute
}

// Click (medium risk)
const clickStep = {
  step_id: 's5',
  action: 'click',
  input: {
    selector: '#submit-button',
    wait_for_selector: '#submit-button'
  }
};

const clickResult = await connector.execute(clickStep, constraints);

// Submit form (high risk - requires approval)
const submitStep = {
  step_id: 's6',
  action: 'submit_form',
  input: {
    selector: 'form#booking-form'
  },
  requires_human_approval: true
};

const submitResult = await connector.execute(submitStep, constraints);
```

### Available Actions

**Read-Only (Low Risk):**
- `open_url` - Navigate to URL
- `extract_text` - Scrape visible text
- `screenshot` - Capture page

**Write Operations (Higher Risk):**
- `click` - Click selector
- `type` - Enter text (requires approval)
- `submit_form` - Submit form (requires approval)
- `download_file` - Download asset (requires approval)

## Integration Patterns

### Pattern 1: Find → Verify → Act

This is the classic orchestration pattern:

```typescript
async function findAndBookCoffeeShop() {
  // 1. Find (Google Places)
  const places = new GooglePlacesConnector({ apiKeyRef: 'KEY_REF' });
  const searchResult = await places.execute({
    step_id: 's1',
    action: 'places_search',
    input: { query: 'coffee shops', location: 'San Francisco' }
  }, { max_results: 5 });

  const topPlace = searchResult.output?.results[0];
  
  // 2. Get details (Google Places)
  const detailsResult = await places.execute({
    step_id: 's2',
    action: 'place_details',
    input: { place_id: topPlace.place_id, fields: ['website'] }
  }, {});

  const website = detailsResult.output?.website;

  // 3. Verify (Playwright - read-only)
  const playwright = new PlaywrightConnector({ headless: true });
  await playwright.execute({
    step_id: 's3',
    action: 'open_url',
    input: { url: website }
  }, { allowlist_domains: [new URL(website).hostname] });

  const screenshot = await playwright.execute({
    step_id: 's4',
    action: 'screenshot',
    input: { full_page: true }
  }, {});

  // 4. Show to user, get approval
  // 5. Act (Playwright - write operations)
  if (userApproved) {
    await playwright.execute({
      step_id: 's5',
      action: 'type',
      input: { selector: '#email', text_ref: 'USER_EMAIL' },
      requires_human_approval: true
    }, {});
  }

  await playwright.close();
}
```

## From TypeScript/JavaScript

### Direct Import

```typescript
// In your TypeScript/JavaScript project
import {
  GooglePlacesConnector,
  PlaywrightConnector,
  PlaywrightPolicy
} from '@glazyr/mcp-connectors';

// Or from relative path
import { GooglePlacesConnector } from './mcp/connectors';
```

### Using Compiled JavaScript

```javascript
// After npm run build, use from dist/
const { GooglePlacesConnector } = require('./mcp/connectors/dist');

const connector = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF'
});
```

## From Python (glazyr-control)

### Option 1: HTTP API Bridge

Create an HTTP server that wraps the connectors:

```typescript
// mcp/connectors/server.ts
import express from 'express';
import { GooglePlacesConnector, PlaywrightConnector } from './index';

const app = express();
app.use(express.json());

const placesConnector = new GooglePlacesConnector({
  apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF
});

app.post('/mcp/google-places/execute', async (req, res) => {
  const { step, constraints } = req.body;
  const result = await placesConnector.execute(step, constraints);
  res.json(result);
});

app.listen(3001);
```

Then call from Python:

```python
# glazyr-control/src/connectors.py
import requests

def execute_google_places(step, constraints):
    response = requests.post(
        'http://localhost:3001/mcp/google-places/execute',
        json={'step': step, 'constraints': constraints}
    )
    return response.json()
```

### Option 2: Subprocess Bridge

```python
# glazyr-control/src/connectors.py
import subprocess
import json

def execute_google_places(step, constraints):
    """Call TypeScript connector via Node.js subprocess"""
    script = f"""
    const {{ GooglePlacesConnector }} = require('./mcp/connectors/dist');
    const connector = new GooglePlacesConnector({{
      apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF
    }});
    
    connector.execute({json.dumps(step)}, {json.dumps(constraints)})
      .then(result => console.log(JSON.stringify(result)))
      .catch(err => {{ console.error(err); process.exit(1); }});
    """
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        env={**os.environ, 'GOOGLE_PLACES_KEY_REF': 'your-key-ref'}
    )
    
    return json.loads(result.stdout)
```

### Option 3: Expose as MCP Tools

Add connectors to your MCP manifest:

```python
# glazyr-control/src/mcp.py

def mcp_manifest() -> Dict[str, Any]:
    return {
        "protocol": "mcp",
        "version": "0.1",
        "tools": [
            {
                "name": "agent_executor",
                "description": "Run the Glazyr-Control agent",
                # ... existing tool
            },
            {
                "name": "google_places_search",
                "description": "Search for places using Google Places API",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "location": {"type": "string"},
                        "max_results": {"type": "number", "default": 10}
                    }
                }
            },
            {
                "name": "playwright_navigate",
                "description": "Navigate to URL using Playwright",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"},
                        "allowlist_domains": {"type": "array", "items": {"type": "string"}}
                    }
                }
            }
        ]
    }

def invoke(payload: Any, *, store: TaskStore, model: str) -> Dict[str, Any]:
    tool, inputs = _normalize_invoke_request(payload)
    
    if tool == "google_places_search":
        # Call TypeScript connector (via bridge)
        from .connectors import execute_google_places
        step = {
            "step_id": f"s{int(time.time())}",
            "action": "places_search",
            "input": inputs
        }
        constraints = {
            "max_results": inputs.get("max_results", 10),
            "budget": {"api_calls": 3}
        }
        return execute_google_places(step, constraints)
    
    elif tool == "playwright_navigate":
        # Call TypeScript connector
        from .connectors import execute_playwright
        step = {
            "step_id": f"s{int(time.time())}",
            "action": "open_url",
            "input": {"url": inputs["url"]}
        }
        constraints = {
            "allowlist_domains": inputs.get("allowlist_domains", [])
        }
        return execute_playwright(step, constraints)
    
    # ... existing agent_executor logic
```

## From Chrome Extension

The Playwright connector should run **locally in the extension** for security:

```typescript
// glazyr-extension/src/connectors/playwright-bridge.ts

// Import compiled connector
import { PlaywrightConnector, PlaywrightPolicy } from '../../mcp/connectors/dist';

// Initialize connector in extension context
let playwrightConnector: PlaywrightConnector | null = null;

export async function initPlaywrightConnector() {
  if (!playwrightConnector) {
    playwrightConnector = new PlaywrightConnector(
      { headless: false }, // Show browser in extension
      new PlaywrightPolicy()
    );
  }
  return playwrightConnector;
}

// Bridge function for extension background script
export async function executePlaywrightStep(
  step: MCPStep,
  constraints: MCPConstraints
): Promise<ExecutionResult> {
  const connector = await initPlaywrightConnector();
  
  // Resolve text references from extension secure storage
  if (step.action === 'type' && step.input.text_ref) {
    const text = await chrome.storage.local.get(`secure_${step.input.text_ref}`);
    step.input.text = text[`secure_${step.input.text_ref}`];
  }
  
  // Dry run first
  const dryRun = await connector.dryRun(step, constraints);
  if (!dryRun.allowed) {
    return {
      status: 'blocked',
      step_id: step.step_id,
      error: dryRun.reason
    };
  }
  
  // Check if human approval needed
  if (dryRun.requiresHumanApproval && !step.requires_human_approval) {
    // Show approval UI in extension popup
    const approved = await showApprovalUI(step, dryRun);
    if (!approved) {
      return {
        status: 'blocked',
        step_id: step.step_id,
        error: 'Human approval denied'
      };
    }
    step.requires_human_approval = true;
  }
  
  // Execute
  const result = await connector.execute(step, constraints);
  
  // Emit audit event
  const audit = connector.auditEvent(result);
  chrome.runtime.sendMessage({
    type: 'AUDIT_EVENT',
    data: audit
  });
  
  return result;
}

// In background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_PLAYWRIGHT_STEP') {
    executePlaywrightStep(message.step, message.constraints)
      .then(sendResponse);
    return true; // Async response
  }
});
```

## Complete Examples

### Example 1: Simple Places Search

```typescript
import { GooglePlacesConnector } from './mcp/connectors';

async function searchCoffeeShops() {
  const connector = new GooglePlacesConnector({
    apiKeyRef: 'GOOGLE_PLACES_KEY_REF'
  });

  const result = await connector.execute({
    step_id: 's1',
    action: 'places_search',
    input: {
      query: 'coffee shops',
      location: 'San Francisco'
    }
  }, {
    max_results: 5,
    fields: ['place_id', 'name', 'rating']
  });

  console.log('Results:', result.output?.results);
}
```

### Example 2: Browser Automation with Approval

```typescript
import { PlaywrightConnector, PlaywrightPolicy } from './mcp/connectors';

async function automateWithApproval() {
  const connector = new PlaywrightConnector(
    { headless: false },
    new PlaywrightPolicy()
  );

  try {
    // Navigate (safe)
    await connector.execute({
      step_id: 's1',
      action: 'open_url',
      input: { url: 'https://example.com/login' }
    }, {
      allowlist_domains: ['example.com']
    });

    // Type (requires approval)
    const typeStep = {
      step_id: 's2',
      action: 'type',
      input: {
        selector: '#email',
        text_ref: 'USER_EMAIL'
      },
      requires_human_approval: true // User must approve
    };

    const result = await connector.execute(typeStep, {
      allowlist_domains: ['example.com']
    });

    console.log('Typed:', result.status);
  } finally {
    await connector.close();
  }
}
```

### Example 3: Full Orchestration

See `mcp/connectors/examples.ts` for the complete "Find → Verify → Act" example.

## Security Best Practices

1. **Never pass raw secrets**: Always use `text_ref` for sensitive data
2. **Always dry run first**: Check `dryRun()` before `execute()`
3. **Enforce constraints**: Set allowlists, budgets, and approval gates
4. **Audit everything**: Use `auditEvent()` to log all executions
5. **Handle errors**: Check `result.status` and handle `'blocked'` and `'error'` cases

## Troubleshooting

### Playwright not found
```bash
npm install playwright
npx playwright install
```

### API key resolution fails
- Ensure secure vault is configured
- Check `apiKeyRef` matches vault reference
- Verify environment variables if using `process.env`

### TypeScript compilation errors
```bash
cd mcp/connectors
npm run build
```

### Browser doesn't launch
- Check Playwright browsers are installed: `npx playwright install`
- Verify headless mode settings
- Check system permissions

## Next Steps

1. **Integrate with glazyr-control**: Add connector bridge functions
2. **Add to extension**: Implement Playwright bridge in extension
3. **Configure secure vault**: Set up key resolution for production
4. **Add tests**: Write unit and integration tests
5. **Monitor usage**: Track API calls and execution metrics
