# API Key Requirements Explained

## Quick Answer

- **Google Places**: ✅ **Yes, needs API key** (calls external Google API)
- **Playwright**: ❌ **No API key needed** (runs locally in your browser)

## Detailed Explanation

### Google Places Connector - Needs API Key

**Why?** Google Places makes HTTP requests to Google's Places API service.

```typescript
// This makes an actual HTTP call to Google's servers
const connector = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF' // ← This resolves to a Google API key
});

// Behind the scenes, it calls:
// POST https://places.googleapis.com/v1/places:searchText
// Headers: { 'X-Goog-Api-Key': 'your-actual-api-key' }
```

**How to get a Google Places API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable "Places API (New)"
4. Create credentials → API Key
5. Restrict the key to "Places API" for security

**Cost:** Google Places API has usage-based pricing (free tier available)

### Playwright Connector - No API Key Needed

**Why?** Playwright runs a browser locally on your machine - no external service calls.

```typescript
// This launches a browser on YOUR computer
const connector = new PlaywrightConnector(
  { headless: true },
  new PlaywrightPolicy()
);

// Behind the scenes, it:
// 1. Launches Chromium/Firefox/WebKit (already installed on your machine)
// 2. Opens a browser window
// 3. Navigates to URLs
// 4. Clicks, types, etc. - all local operations
```

**What Playwright DOES need:**
- ✅ Playwright package installed (`npm install playwright`)
- ✅ Browser binaries installed (`npx playwright install`) - **Already done!**
- ❌ No API key needed

## Comparison Table

| Connector | API Key Required? | What It Does | Cost |
|-----------|------------------|--------------|------|
| **Google Places** | ✅ Yes | Calls Google's Places API (external service) | Usage-based (free tier) |
| **Playwright** | ❌ No | Runs browser locally on your machine | Free (open source) |

## Setting Up Google Places API Key

### Option 1: Environment Variable (Development)

```bash
# Set environment variable
export GOOGLE_PLACES_API_KEY_REF="your-actual-google-api-key"

# Or in PowerShell
$env:GOOGLE_PLACES_API_KEY_REF = "your-actual-google-api-key"
```

Then in code:
```typescript
const connector = new GooglePlacesConnector({
  apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF
});
```

### Option 2: Secure Vault (Production)

```typescript
// In your secure vault service
async function resolveApiKey(ref: string): Promise<string> {
  // Fetch from secure storage (AWS Secrets Manager, Vault, etc.)
  const apiKey = await secureVault.get(`GOOGLE_PLACES_API_KEY_${ref}`);
  return apiKey;
}

const connector = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF' // Reference, not the actual key
});
```

The connector's `resolveApiKey()` method will call your vault to get the actual key.

### Option 3: Direct (Not Recommended for Production)

```typescript
// ⚠️ Only for development/testing
const connector = new GooglePlacesConnector({
  apiKey: 'your-actual-api-key' // Direct key (not secure)
});
```

## Testing Without API Key

### Google Places - Will Fail

```typescript
const connector = new GooglePlacesConnector({
  apiKeyRef: 'MISSING_KEY'
});

const result = await connector.execute(step, constraints);
// result.status === 'error'
// result.error === 'Google Places API key not configured'
```

### Playwright - Works Fine

```typescript
const connector = new PlaywrightConnector({ headless: true });

// This works immediately - no API key needed!
const result = await connector.execute({
  step_id: 's1',
  action: 'open_url',
  input: { url: 'https://example.com' }
}, { allowlist_domains: ['example.com'] });
```

## Demo Script Behavior

When you run `npm run demo`:

1. **Google Places demo**: Will show "Execution blocked" or "API key not configured" if no key is set
2. **Playwright demo**: Will work immediately (no API key needed)

## Summary

- **Google Places** = External API service → Needs API key → Costs money (after free tier)
- **Playwright** = Local browser automation → No API key → Free

Both connectors are ready to use, but Google Places requires API key setup first.
