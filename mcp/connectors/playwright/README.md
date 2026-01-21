# Playwright MCP Connector

## Role: Agentic Hands

Safe browser automation with:
- ✅ Deterministic steps
- ✅ Domain allowlists
- ✅ Human-in-the-loop gating
- ✅ Full replayability

**⚠️ Key Philosophy**: This is NOT "let the LLM drive the browser freely."
This is: **LLM proposes → MCP constrains → Playwright executes.**

## Risk Level: **High**

Requires strong policy enforcement, dry-runs, and human approval hooks.

## Supported MCP Actions

| MCP Action | Description | Risk Level |
|------------|-------------|------------|
| `open_url` | Navigate to URL | Low |
| `click` | Click selector | Medium |
| `type` | Enter text | High (PII risk) |
| `submit_form` | Submit form | High |
| `extract_text` | Scrape visible text | Low |
| `screenshot` | Capture page | Medium |
| `download_file` | Download asset | High |

## Example MCP Plan

### Step 1: Navigate (Low Risk)

```json
{
  "step_id": "s2",
  "action": "open_url",
  "target": "https://example.com/login",
  "input": {
    "url": "https://example.com/login"
  },
  "dry_run": true
}
```

### Step 2: Type (High Risk - Requires Approval)

```json
{
  "step_id": "s3",
  "action": "type",
  "target": "#email",
  "input": {
    "text_ref": "USER_EMAIL"
  },
  "requires_human_approval": true
}
```

**⚠️ Key Rule**: The connector never receives raw secrets. It receives references resolved locally by the extension or secure vault.

## Constraint Enforcement

The connector blocks execution if:

- ❌ URL not in `allowlist_domains`
- ❌ Selector targets password fields without approval
- ❌ Action type is destructive without explicit approval
- ❌ Time, click, or navigation budgets exceeded

### Example Constraints

```json
{
  "constraints": {
    "allowlist_domains": ["example.com"],
    "deny_actions": ["submit_form"],
    "human_approval_required": true,
    "budget": {
      "max_steps": 10,
      "max_time_ms": 30000
    }
  }
}
```

## Execution Result Payload

```json
{
  "status": "success",
  "step_id": "s3",
  "output": {
    "typed": true,
    "selector": "#email"
  },
  "telemetry": {
    "duration_ms": 421,
    "url": "https://example.com/login"
  },
  "proof": {
    "screenshot_hash": "sha256:...",
    "dom_snapshot_hash": "sha256:..."
  }
}
```

This is **auditable and replayable**, which is critical for trust.

## Policy Enforcement

The connector enforces safety through:

1. **URL Allowlisting**: Only allowed domains can be accessed
2. **Action Deny Lists**: Specific actions can be blocked
3. **Password Field Protection**: Automatic blocking of password field interactions
4. **Destructive Action Gating**: Form submissions and downloads require explicit approval
5. **Budget Limits**: Time and step budgets prevent runaway execution

## Failure Modes

1. **Policy Violation**: Execution blocked if constraints are violated
2. **Human Approval Missing**: High-risk actions require explicit approval flag
3. **Budget Exceeded**: Execution stops if time/step budgets are exceeded
4. **Browser Initialization Failure**: Returns error if Playwright cannot start
5. **Selector Not Found**: Returns error if target element doesn't exist

## Integration Example

```typescript
import { PlaywrightConnector } from './index';
import { PlaywrightPolicy } from './policy';

const policy = new PlaywrightPolicy();
const connector = new PlaywrightConnector(
  { headless: true, timeout: 30000 },
  policy
);

// Authorize
const auth = await connector.authorize({});

// Dry run
const step = {
  step_id: "s1",
  action: "open_url",
  input: { url: "https://example.com" }
};

const dryRun = await connector.dryRun(step, {
  allowlist_domains: ["example.com"],
  budget: { max_steps: 10 }
});

if (dryRun.allowed && !dryRun.requiresHumanApproval) {
  const result = await connector.execute(step, {
    allowlist_domains: ["example.com"],
    budget: { max_steps: 10 }
  });
  
  const audit = connector.auditEvent(result);
  console.log('Audit event:', audit);
}

// Cleanup
await connector.close();
```

## Security Notes

- **Never receives raw secrets**: Only text references that are resolved by secure vault
- **Full audit trail**: Every action is logged with proof hashes
- **Replayable**: DOM snapshots enable full replay of execution
- **Kill switch**: Policy violations immediately block execution

## Installation

```bash
npm install playwright
# Or
yarn add playwright
```

Note: The connector requires Playwright to be installed. Uncomment the initialization code in `index.ts` after installation.
