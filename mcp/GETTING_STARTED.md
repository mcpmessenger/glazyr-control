# Getting Started with MCP Connectors

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd mcp/connectors
npm install
npx playwright install  # Already done, but verify
```

### 2. Try the Demo

```bash
# Run demo script
npm run demo

# Or compile and run
npm run build
node dist/demo.js
```

### 3. Basic Usage

```typescript
// Import connectors
import { GooglePlacesConnector, PlaywrightConnector, PlaywrightPolicy } from './mcp/connectors';

// Google Places - Search
const places = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF'
});

const result = await places.execute({
  step_id: 's1',
  action: 'places_search',
  input: { query: 'coffee shops', location: 'San Francisco' }
}, { max_results: 5 });

// Playwright - Browser automation
const playwright = new PlaywrightConnector(
  { headless: true },
  new PlaywrightPolicy()
);

await playwright.execute({
  step_id: 's1',
  action: 'open_url',
  input: { url: 'https://example.com' }
}, { allowlist_domains: ['example.com'] });

await playwright.close();
```

## Integration Options

### Option 1: Use from TypeScript/JavaScript

```typescript
// Direct import (after npm install)
import { GooglePlacesConnector } from './mcp/connectors';

const connector = new GooglePlacesConnector({
  apiKeyRef: 'YOUR_KEY_REF'
});
```

### Option 2: Use from Python (glazyr-control)

Create a bridge function:

```python
# glazyr-control/src/connectors.py
import subprocess
import json

def execute_google_places(step, constraints):
    """Call TypeScript connector via Node.js"""
    script = f"""
    const {{ GooglePlacesConnector }} = require('../mcp/connectors/dist');
    const connector = new GooglePlacesConnector({{
      apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF
    }});
    connector.execute({json.dumps(step)}, {json.dumps(constraints)})
      .then(r => console.log(JSON.stringify(r)))
      .catch(e => {{ console.error(e); process.exit(1); }});
    """
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True)
    return json.loads(result.stdout)
```

### Option 3: Use from Chrome Extension

```typescript
// glazyr-extension/src/connectors/playwright-bridge.ts
import { PlaywrightConnector } from '../../mcp/connectors/dist';

let connector: PlaywrightConnector | null = null;

export async function executeStep(step, constraints) {
  if (!connector) {
    connector = new PlaywrightConnector({ headless: false });
  }
  
  // Resolve text_ref from extension storage
  if (step.input.text_ref) {
    const stored = await chrome.storage.local.get(`secure_${step.input.text_ref}`);
    step.input.text = stored[`secure_${step.input.text_ref}`];
  }
  
  return await connector.execute(step, constraints);
}
```

## Configuration

### Google Places API Key

Set up secure vault resolution:

```typescript
// In your secure vault service
const apiKey = await vault.resolve('GOOGLE_PLACES_KEY_REF');
process.env.GOOGLE_PLACES_API_KEY_REF = apiKey;
```

Or for development:

```bash
export GOOGLE_PLACES_API_KEY_REF="your-actual-api-key"
```

### Playwright Configuration

```typescript
const connector = new PlaywrightConnector({
  headless: true,        // Run browser in background
  timeout: 30000,        // 30 second timeout
  screenshotOnError: true // Capture screenshots on errors
}, new PlaywrightPolicy());
```

## Common Patterns

### Pattern 1: Always Dry Run First

```typescript
const dryRun = await connector.dryRun(step, constraints);
if (!dryRun.allowed) {
  console.error('Blocked:', dryRun.reason);
  return;
}

if (dryRun.requiresHumanApproval && !step.requires_human_approval) {
  // Show approval UI
  step.requires_human_approval = true;
}

const result = await connector.execute(step, constraints);
```

### Pattern 2: Find → Verify → Act

```typescript
// 1. Find (Google Places)
const places = new GooglePlacesConnector({ apiKeyRef: 'KEY' });
const search = await places.execute({
  step_id: 's1',
  action: 'places_search',
  input: { query: 'coffee shops' }
}, {});

// 2. Verify (Playwright - read-only)
const playwright = new PlaywrightConnector({ headless: true });
await playwright.execute({
  step_id: 's2',
  action: 'open_url',
  input: { url: search.output.results[0].website }
}, {});

const screenshot = await playwright.execute({
  step_id: 's3',
  action: 'screenshot',
  input: { full_page: true }
}, {});

// 3. Act (Playwright - write, with approval)
if (userApproved) {
  await playwright.execute({
    step_id: 's4',
    action: 'type',
    input: { selector: '#email', text_ref: 'USER_EMAIL' },
    requires_human_approval: true
  }, {});
}
```

## Next Steps

1. **Read the full guide**: [USAGE_GUIDE.md](./USAGE_GUIDE.md)
2. **Check quick reference**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
3. **See examples**: [connectors/examples.ts](./connectors/examples.ts)
4. **Run the demo**: `npm run demo`

## Troubleshooting

### "Playwright not initialized"
```bash
npm install playwright
npx playwright install
```

### "API key not configured"
- Set up secure vault resolution
- Or set `GOOGLE_PLACES_API_KEY_REF` environment variable

### TypeScript errors
```bash
npm run build
```

### Browser doesn't launch
- Check Playwright browsers: `npx playwright install`
- Verify system permissions
- Try `headless: false` to see browser

## Support

- **Documentation**: See [README.md](./README.md)
- **Examples**: See [connectors/examples.ts](./connectors/examples.ts)
- **Usage Guide**: See [USAGE_GUIDE.md](./USAGE_GUIDE.md)
