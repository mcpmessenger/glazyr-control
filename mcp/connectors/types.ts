/**
 * MCP Connector Base Types
 * 
 * Defines the core interface that all MCP connectors must implement.
 * This ensures consistent behavior across different connector types.
 */

export interface AuthContext {
  authenticated: boolean;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface DryRunResult {
  allowed: boolean;
  reason?: string;
  estimatedRisk?: 'low' | 'medium' | 'high';
  requiresHumanApproval?: boolean;
  warnings?: string[];
}

export interface ExecutionResult {
  status: 'success' | 'error' | 'blocked';
  step_id: string;
  output?: Record<string, unknown>;
  error?: string;
  telemetry?: {
    duration_ms?: number;
    api_calls_used?: number;
    [key: string]: unknown;
  };
  proof?: {
    screenshot_hash?: string;
    dom_snapshot_hash?: string;
    [key: string]: string | undefined;
  };
}

export interface RevertResult {
  status: 'success' | 'error' | 'not_revertible';
  message?: string;
}

export interface AuditEvent {
  timestamp: number;
  connector: string;
  step_id: string;
  action: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface MCPStep {
  step_id: string;
  action: string;
  target?: string;
  input: Record<string, unknown>;
  dry_run?: boolean;
  requires_human_approval?: boolean;
}

export interface MCPConstraints {
  allowlist_domains?: string[];
  deny_actions?: string[];
  human_approval_required?: boolean;
  budget?: {
    max_steps?: number;
    max_time_ms?: number;
    api_calls?: number;
  };
  max_results?: number;
  fields?: string[];
  [key: string]: unknown;
}

export interface MCPConnector {
  name: string;
  version: string;

  authorize(context: Record<string, unknown>): Promise<AuthContext>;
  dryRun(step: MCPStep, constraints: MCPConstraints): Promise<DryRunResult>;
  execute(step: MCPStep, constraints: MCPConstraints): Promise<ExecutionResult>;
  revert?(executionId: string): Promise<RevertResult>;
  auditEvent(result: ExecutionResult): AuditEvent;
}
