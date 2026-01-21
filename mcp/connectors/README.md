# MCP Connectors

This directory contains MCP (Model Context Protocol) connectors that provide safe, constrained access to external services and browser automation.

## Philosophy

**Connectors are the hands and eyes of the agent, not the brain.**

- **Playwright** = Embodied hands (executes user-facing actions)
- **Google Places** = Trusted sensory input (provides grounded data)

Both connectors:
- ✅ Accept signed MCP plans
- ✅ Enforce constraints locally
- ✅ Emit auditable execution events
- ✅ Never act without an explicit MCP step

## Connectors

### 1. Google Places (`google-places/`)

**Role**: Trusted sensory input  
**Risk Level**: Low (read-heavy, no destructive actions)

Provides grounded, external truth about:
- Business existence
- Location data
- Ratings
- Hours
- Place IDs

[Read the full documentation →](./google-places/README.md)

### 2. Playwright (`playwright/`)

**Role**: Agentic hands  
**Risk Level**: High (requires strong policy enforcement)

Safe browser automation with:
- Deterministic steps
- Domain allowlists
- Human-in-the-loop gating
- Full replayability

[Read the full documentation →](./playwright/README.md)

## How They Work Together

### Example: "Find the top-rated coffee shop near me and book a meeting there"

1. **Google Places connector** finds candidates and ranks by rating + distance
2. **Planner** chooses top result and generates Playwright steps
3. **Playwright connector** opens business site, finds booking form
4. **Control Plane** shows business source, planned actions, risk score
5. **Human approves** → Execution proceeds

This is a textbook example of **eyes → brain → hands** done safely.

## Base Interface

All connectors implement the `MCPConnector` interface:

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

## Usage Pattern

```typescript
// 1. Initialize connector
const connector = new SomeConnector(config);

// 2. Authorize
const auth = await connector.authorize(context);

// 3. Dry run (safety check)
const dryRun = await connector.dryRun(step, constraints);
if (!dryRun.allowed) {
  // Handle policy violation
}

// 4. Execute (if approved)
if (dryRun.allowed && (!dryRun.requiresHumanApproval || step.requires_human_approval)) {
  const result = await connector.execute(step, constraints);
  
  // 5. Audit
  const audit = connector.auditEvent(result);
  // Log audit event
}
```

## Security Model

1. **Never receives raw secrets**: Connectors use references resolved by secure vault
2. **Constraint enforcement**: All actions validated against constraints before execution
3. **Audit trail**: Every execution emits structured audit events
4. **Replayability**: Proof hashes enable full replay of execution
5. **Kill switch**: Policy violations immediately block execution

## Expansion Path

These two connectors prove the pattern. Future connectors can follow the same model:

- **Stripe**: Payment processing (high risk, strong approval gates)
- **Gmail**: Email operations (medium risk, content filtering)
- **Jira**: Issue tracking (low-medium risk, project scoping)
- **Salesforce**: CRM operations (high risk, data access controls)

## Development

### Adding a New Connector

1. Create a new directory under `connectors/`
2. Implement the `MCPConnector` interface
3. Add policy enforcement (if high-risk)
4. Add audit logging
5. Write comprehensive README
6. Add example MCP plans

### Testing

Each connector should have:
- Unit tests for policy enforcement
- Integration tests for API interactions
- Dry-run validation tests
- Constraint enforcement tests

## License

See root LICENSE file.
