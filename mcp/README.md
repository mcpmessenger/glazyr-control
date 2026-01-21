# MCP Connectors for Glazyr

This directory contains MCP (Model Context Protocol) connectors that provide safe, constrained access to external services and browser automation.

## Overview

The MCP connector system implements the **eyes → brain → hands** architecture:

- **Google Places** = Trusted sensory input (eyes)
- **Orchestrator** = Brain (plans and coordinates)
- **Playwright** = Agentic hands (executes actions)

## Philosophy

**Connectors are the hands and eyes of the agent, not the brain.**

Both connectors:
- ✅ Accept signed MCP plans
- ✅ Enforce constraints locally
- ✅ Emit auditable execution events
- ✅ Never act without an explicit MCP step

## Quick Start

### Installation

```bash
cd mcp/connectors
npm install
```

### Google Places Connector

```typescript
import { GooglePlacesConnector } from './connectors';

const connector = new GooglePlacesConnector({
  apiKeyRef: 'GOOGLE_PLACES_KEY_REF'
});

const step = {
  step_id: 's1',
  action: 'places_search',
  input: { query: 'coffee shops', location: 'San Francisco' }
};

const result = await connector.execute(step, {
  max_results: 10,
  budget: { api_calls: 3 }
});
```

### Playwright Connector

```typescript
import { PlaywrightConnector, PlaywrightPolicy } from './connectors';

const connector = new PlaywrightConnector(
  { headless: true },
  new PlaywrightPolicy()
);

const step = {
  step_id: 's1',
  action: 'open_url',
  input: { url: 'https://example.com' }
};

const result = await connector.execute(step, {
  allowlist_domains: ['example.com'],
  budget: { max_steps: 10 }
});
```

## Directory Structure

```
mcp/
├── connectors/
│   ├── types.ts                    # Base MCP interface types
│   ├── index.ts                    # Main exports
│   ├── package.json                # Dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── examples.ts                 # Usage examples
│   ├── README.md                   # Connector overview
│   ├── google-places/
│   │   ├── index.ts                # Google Places connector
│   │   ├── rateLimit.ts            # Rate limiting
│   │   ├── fields.ts               # Field management
│   │   └── README.md               # Google Places docs
│   └── playwright/
│       ├── index.ts                # Playwright connector
│       ├── policy.ts               # Policy enforcement
│       ├── audit.ts                # Audit logging
│       └── README.md               # Playwright docs
└── README.md                       # This file
```

## Architecture

### MCP Connector Interface

All connectors implement:

```typescript
interface MCPConnector {
  name: string;
  version: string;
  
  authorize(context): Promise<AuthContext>;
  dryRun(step, constraints): Promise<DryRunResult>;
  execute(step, constraints): Promise<ExecutionResult>;
  revert?(executionId): Promise<RevertResult>;
  auditEvent(result): AuditEvent;
}
```

### Execution Flow

1. **Authorize**: Check if connector is ready
2. **Dry Run**: Validate step against constraints (no execution)
3. **Execute**: Perform action if allowed
4. **Audit**: Emit structured audit event

### Constraint Enforcement

Constraints are enforced at multiple levels:

- **URL Allowlisting**: Only allowed domains
- **Action Deny Lists**: Block specific actions
- **Budget Limits**: Time, steps, API calls
- **Human Approval**: Required for high-risk actions

## Security Model

1. **Never receives raw secrets**: Connectors use references resolved by secure vault
2. **Constraint enforcement**: All actions validated before execution
3. **Audit trail**: Every execution emits structured events
4. **Replayability**: Proof hashes enable full replay
5. **Kill switch**: Policy violations immediately block execution

## Integration with Glazyr

These connectors integrate with:

- **glazyr-control**: MCP runtime (Python FastAPI)
- **glazyr-extension**: Chrome extension (execution surface)
- **glazyr-main**: Web control plane (configuration)

The connectors can be used from:
- TypeScript/JavaScript (direct import)
- Python (via bridge/FFI)
- HTTP API (via MCP runtime)

## Development

### Adding a New Connector

1. Create directory under `connectors/`
2. Implement `MCPConnector` interface
3. Add policy enforcement (if high-risk)
4. Add audit logging
5. Write comprehensive README
6. Add example MCP plans

### Testing

```bash
npm test
```

Each connector should have:
- Unit tests for policy enforcement
- Integration tests for API interactions
- Dry-run validation tests
- Constraint enforcement tests

## Examples

See `connectors/examples.ts` for:
- Find → Verify → Act loop
- Simple Google Places search
- Read-only browser operations

## Usage Guide

📖 **[Complete Usage Guide →](./USAGE_GUIDE.md)**

The usage guide covers:
- Quick start examples
- Integration with glazyr-control (Python)
- Integration with glazyr-extension (Chrome)
- Complete orchestration patterns
- Security best practices

📋 **[Quick Reference →](./QUICK_REFERENCE.md)**

## License

See root LICENSE file.
