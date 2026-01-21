# Google Places MCP Connector

## Role: Trusted Sensory Input

The Google Places connector provides **grounded, external truth** about businesses, locations, ratings, hours, and Place IDs. This is a **read-heavy, low-risk** connector that feeds the brain so downstream actions (emails, scheduling, purchases) are defensible.

## Risk Level: **Low**

- Read-only operations
- No destructive actions
- Public data only
- Field-level minimization enforced

## Supported MCP Actions

| Action | Description | Input Required |
|--------|-------------|----------------|
| `places_search` | Text or nearby search | `query` or `location` or `lat`/`lng` |
| `place_details` | Fetch details by Place ID | `place_id` |
| `place_photos` | Retrieve photo metadata | `place_id` |
| `place_hours` | Business hours | `place_id` |
| `place_reviews` | Public review summaries | `place_id` |

## Example MCP Plan

```json
{
  "step_id": "s1",
  "action": "places_search",
  "target": "google_places",
  "input": {
    "query": "coffee shops near Union Square",
    "location": "San Francisco",
    "radius_meters": 1500
  }
}
```

## Connector Constraints

```json
{
  "constraints": {
    "max_results": 10,
    "fields": [
      "place_id",
      "name",
      "rating",
      "address",
      "opening_hours"
    ],
    "budget": {
      "api_calls": 3
    }
  }
}
```

The connector:
- ✅ Enforces field-level minimization
- ✅ Tracks API usage
- ✅ Prevents unnecessary data collection
- ✅ Never receives raw secrets (only references)

## Execution Result

```json
{
  "status": "success",
  "step_id": "s1",
  "output": {
    "results": [
      {
        "place_id": "ChIJ...",
        "name": "Blue Bottle Coffee",
        "rating": 4.5,
        "open_now": true
      }
    ]
  },
  "telemetry": {
    "api_calls_used": 1,
    "duration_ms": 234
  }
}
```

## Configuration

The connector requires a Google Places API key, but **never receives raw secrets**. Instead, it uses references that are resolved by the extension or secure vault:

```typescript
const connector = new GooglePlacesConnector({
  apiKeyRef: "GOOGLE_PLACES_KEY_REF" // Resolved by secure vault
});
```

## Failure Modes

1. **API Key Missing**: Returns error if key cannot be resolved
2. **Budget Exceeded**: Blocks execution if API call budget is exceeded
3. **Invalid Input**: Validates input structure before execution
4. **Rate Limiting**: Enforces per-minute and daily limits

## Integration Example

```typescript
import { GooglePlacesConnector } from './index';

const connector = new GooglePlacesConnector({
  apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF
});

// Authorize
const auth = await connector.authorize({});

// Dry run
const step = {
  step_id: "s1",
  action: "places_search",
  input: { query: "coffee shops", location: "San Francisco" }
};

const dryRun = await connector.dryRun(step, {
  max_results: 10,
  budget: { api_calls: 3 }
});

if (dryRun.allowed) {
  const result = await connector.execute(step, {
    max_results: 10,
    budget: { api_calls: 3 }
  });
  
  const audit = connector.auditEvent(result);
  console.log('Audit event:', audit);
}
```
