# Testing Playwright Connector

## Quick Test (30 seconds)

### Option 1: Run Test Script

```bash
cd mcp/connectors
npm run test:playwright
```

This will:
1. ✅ Launch a browser (you'll see it open)
2. ✅ Navigate to example.com
3. ✅ Extract text from the page
4. ✅ Take a screenshot
5. ✅ Test policy enforcement (blocked domains)
6. ✅ Generate audit events

### Option 2: Compile and Run

```bash
cd mcp/connectors
npm run build
node dist/test-playwright.js
```

## What You'll See

When you run the test:

1. **Browser opens** (if `headless: false`)
   - You'll see Chromium launch
   - It navigates to https://example.com
   - Page loads and displays

2. **Console output**:
   ```
   🚀 Testing Playwright Connector

   Test 1: Navigating to example.com...
      Dry run result: ✅ Allowed
      ✅ Navigation successful!
      URL: https://example.com/
      Duration: 1234 ms

   Test 2: Extracting page text...
      ✅ Text extracted!
      Text length: 1234 characters
      Preview: Example Domain This domain is for use in illustrative examples...

   Test 3: Taking screenshot...
      ✅ Screenshot captured!
      Screenshot hash: sha256:abc123...
      DOM snapshot hash: sha256:def456...

   Test 4: Testing policy enforcement...
      ✅ Policy correctly blocked unauthorized domain!
      Reason: URL host not allowlisted: google.com

   Test 5: Testing audit event...
      ✅ Audit event created:
      { "timestamp": 1234567890, "connector": "playwright", ... }

   ✅ All tests completed successfully!
   ```

3. **Browser closes** automatically at the end

## Manual Testing

### Test 1: Basic Navigation

```typescript
import { PlaywrightConnector, PlaywrightPolicy } from './playwright';

const connector = new PlaywrightConnector(
  { headless: false }, // See the browser
  new PlaywrightPolicy()
);

try {
  const result = await connector.execute({
    step_id: 'test-1',
    action: 'open_url',
    input: { url: 'https://example.com' }
  }, {
    allowlist_domains: ['example.com']
  });

  console.log('Result:', result);
} finally {
  await connector.close();
}
```

### Test 2: Extract Text

```typescript
// After navigating...
const result = await connector.execute({
  step_id: 'test-2',
  action: 'extract_text',
  input: {}
}, {});

console.log('Page text:', result.output?.text);
```

### Test 3: Screenshot

```typescript
const result = await connector.execute({
  step_id: 'test-3',
  action: 'screenshot',
  input: { full_page: true }
}, {});

console.log('Screenshot hash:', result.proof?.screenshot_hash);
```

### Test 4: Policy Enforcement

```typescript
// Try to navigate to blocked domain
const dryRun = await connector.dryRun({
  step_id: 'test-4',
  action: 'open_url',
  input: { url: 'https://google.com' }
}, {
  allowlist_domains: ['example.com'] // Only example.com allowed
});

console.log('Blocked?', !dryRun.allowed);
console.log('Reason:', dryRun.reason);
```

## Troubleshooting

### Browser doesn't open

**Check:**
```bash
# Verify Playwright browsers are installed
npx playwright install

# Try with headless: false to see browser
const connector = new PlaywrightConnector({ headless: false });
```

### "Playwright not initialized" error

**Fix:**
```bash
npm install playwright
npx playwright install
```

Then rebuild:
```bash
npm run build
```

### Timeout errors

**Increase timeout:**
```typescript
const connector = new PlaywrightConnector({
  timeout: 60000 // 60 seconds
});
```

### Policy blocks everything

**Check allowlist:**
```typescript
const constraints = {
  allowlist_domains: ['example.com', 'google.com'] // Add allowed domains
};
```

Or allow all (for testing only):
```typescript
const constraints = {
  // Empty allowlist = allow all (for development)
};
```

## Advanced Testing

### Test with Different Browsers

Playwright supports Chromium, Firefox, and WebKit. The connector uses Chromium by default, but you can modify it:

```typescript
// In playwright/index.ts, change:
const { chromium } = require('playwright');
// To:
const { firefox } = require('playwright'); // or webkit
```

### Test Write Operations

```typescript
// Type operation (requires approval)
const typeStep = {
  step_id: 'test-type',
  action: 'type',
  input: {
    selector: 'input[type="text"]',
    text_ref: 'TEST_TEXT'
  },
  requires_human_approval: true
};

// First check dry run
const dryRun = await connector.dryRun(typeStep, constraints);
console.log('Requires approval?', dryRun.requiresHumanApproval);
console.log('Risk level:', dryRun.estimatedRisk);

// Then execute (if approved)
if (dryRun.allowed && typeStep.requires_human_approval) {
  const result = await connector.execute(typeStep, constraints);
  console.log('Typed:', result.status);
}
```

### Test Click Operation

```typescript
const clickStep = {
  step_id: 'test-click',
  action: 'click',
  input: {
    selector: 'a[href]',
    wait_for_selector: 'a[href]'
  }
};

const result = await connector.execute(clickStep, constraints);
console.log('Clicked:', result.status);
```

## Expected Results

### ✅ Success Indicators

- Browser opens and navigates
- Text extraction returns content
- Screenshot hash is generated
- Policy blocks unauthorized domains
- Audit events are created
- Browser closes cleanly

### ❌ Failure Indicators

- Browser doesn't open → Check Playwright installation
- Navigation fails → Check URL and network
- Policy blocks everything → Check allowlist configuration
- Timeout errors → Increase timeout or check network
- TypeScript errors → Run `npm run build`

## Next Steps

After testing:

1. **Integrate with your app**: See [USAGE_GUIDE.md](../USAGE_GUIDE.md)
2. **Test with real websites**: Change URLs in test script
3. **Test write operations**: Add type/click/submit tests
4. **Test policy enforcement**: Try different constraint combinations

## Quick Reference

```bash
# Run test
npm run test:playwright

# Compile and run
npm run build && node dist/test-playwright.js

# Run with specific browser visible
# (Edit test-playwright.ts, set headless: false)
```
