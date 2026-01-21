# How to Test Playwright - Quick Answer

## Important: This is NOT the Extension

The Playwright connector is a **standalone Node.js library** - it's separate from your Chrome extension. You test it from the command line, not in the browser.

## Quick Test Steps

### 1. Navigate to the Connectors Directory

```bash
cd C:\Users\senti\OneDrive\Desktop\glazyr\mcp\connectors
```

**Yes, you need to be in this subdirectory** - that's where the test script lives.

### 2. Install ts-node (one-time)

```bash
npm install --save-dev ts-node
```

### 3. Run the Test

```bash
npm run test:playwright
```

**That's it!** No extension reload needed. The browser will open automatically.

## What Happens

- ✅ A Chromium browser window opens (separate from Chrome)
- ✅ It navigates to example.com
- ✅ You see it in action
- ✅ Console shows test results
- ✅ Browser closes automatically

## This is Different from Extension Testing

| What | Where | How to Test |
|------|-------|-------------|
| **Playwright Connector** | `mcp/connectors/` | Command line: `npm run test:playwright` |
| **Chrome Extension** | `glazyr-extension/` | Load in Chrome, reload extension |

## If You Want to Use Playwright IN the Extension

That's a separate integration step. The connector would need to be:
1. Compiled and bundled
2. Imported into the extension
3. Run in the extension's context

But for now, **just test it standalone** from the command line.

## Quick Reference

```bash
# Always start here
cd mcp/connectors

# Then run
npm run test:playwright
```

No extension reload needed - this runs independently!
