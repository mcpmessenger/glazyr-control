# Quick Test Guide - Playwright

## Fastest Way to Test (No API Key Needed!)

### Step 1: Install ts-node (if needed)

```bash
cd mcp/connectors
npm install --save-dev ts-node
```

### Step 2: Run the Test

```bash
npm run test:playwright
```

**That's it!** The browser will open, navigate to example.com, extract text, take a screenshot, and close.

## What Happens

1. ✅ Browser launches (you'll see it)
2. ✅ Navigates to https://example.com
3. ✅ Extracts all text from the page
4. ✅ Takes a full-page screenshot
5. ✅ Tests policy enforcement (blocks unauthorized domains)
6. ✅ Generates audit events
7. ✅ Closes browser

## Alternative: Compile First

If you don't want to install ts-node:

```bash
cd mcp/connectors
npm run build
node dist/test-playwright.js
```

## Expected Output

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
   Preview: Example Domain This domain is for use...

Test 3: Taking screenshot...
   ✅ Screenshot captured!
   Screenshot hash: sha256:abc123...
   DOM snapshot hash: sha256:def456...

Test 4: Testing policy enforcement...
   ✅ Policy correctly blocked unauthorized domain!

Test 5: Testing audit event...
   ✅ Audit event created

✅ All tests completed successfully!
```

## Troubleshooting

### "ts-node not found"
```bash
npm install --save-dev ts-node
```

### "Playwright not initialized"
```bash
npx playwright install
```

### Browser doesn't open
- Check if `headless: false` in test script
- Try running with `headless: true` to run in background

## Next Steps

- See [TESTING_PLAYWRIGHT.md](./TESTING_PLAYWRIGHT.md) for detailed testing guide
- See [USAGE_GUIDE.md](./USAGE_GUIDE.md) for integration patterns
