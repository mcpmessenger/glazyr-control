# MCP Connectors Quick Reference

## Google Places Connector

### Initialize
```typescript
const connector = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF'
});
```

### Search Places
```typescript
const result = await connector.execute({
  step_id: 's1',
  action: 'places_search',
  input: { query: 'coffee shops', location: 'San Francisco' }
}, { max_results: 10 });
```

### Get Details
```typescript
const result = await connector.execute({
  step_id: 's2',
  action: 'place_details',
  input: { place_id: 'ChIJ...' }
}, {});
```

## Playwright Connector

### Initialize
```typescript
const connector = new PlaywrightConnector(
  { headless: true },
  new PlaywrightPolicy()
);
```

### Navigate (Safe)
```typescript
const result = await connector.execute({
  step_id: 's1',
  action: 'open_url',
  input: { url: 'https://example.com' }
}, { allowlist_domains: ['example.com'] });
```

### Extract Text (Safe)
```typescript
const result = await connector.execute({
  step_id: 's2',
  action: 'extract_text',
  input: {}
}, {});
```

### Screenshot (Safe)
```typescript
const result = await connector.execute({
  step_id: 's3',
  action: 'screenshot',
  input: { full_page: true }
}, {});
```

### Type (Requires Approval)
```typescript
const result = await connector.execute({
  step_id: 's4',
  action: 'type',
  input: { selector: '#email', text_ref: 'USER_EMAIL' },
  requires_human_approval: true
}, {});
```

### Click
```typescript
const result = await connector.execute({
  step_id: 's5',
  action: 'click',
  input: { selector: '#button' }
}, {});
```

### Always Cleanup
```typescript
await connector.close();
```

## Standard Pattern

```typescript
// 1. Dry run first
const dryRun = await connector.dryRun(step, constraints);
if (!dryRun.allowed) {
  console.error('Blocked:', dryRun.reason);
  return;
}

// 2. Check approval
if (dryRun.requiresHumanApproval && !step.requires_human_approval) {
  // Show UI, wait for user approval
  step.requires_human_approval = true;
}

// 3. Execute
const result = await connector.execute(step, constraints);

// 4. Audit
const audit = connector.auditEvent(result);
```

## Common Constraints

```typescript
// Google Places
const constraints = {
  max_results: 10,
  fields: ['place_id', 'name', 'rating'],
  budget: { api_calls: 3 }
};

// Playwright
const constraints = {
  allowlist_domains: ['example.com'],
  deny_actions: ['submit_form'],
  human_approval_required: true,
  budget: { max_steps: 10, max_time_ms: 30000 }
};
```

## Available Actions

### Google Places
- `places_search` - Search for places
- `place_details` - Get place details
- `place_photos` - Get photos
- `place_hours` - Get hours
- `place_reviews` - Get reviews

### Playwright (Read-Only)
- `open_url` - Navigate
- `extract_text` - Scrape text
- `screenshot` - Capture page

### Playwright (Write - Requires Approval)
- `click` - Click element
- `type` - Type text
- `submit_form` - Submit form
- `download_file` - Download file
