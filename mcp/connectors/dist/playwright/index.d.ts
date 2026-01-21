/**
 * Playwright MCP Connector
 *
 * Role: Embodied hands - executes user-facing actions in a controlled local environment.
 *
 * Risk Level: High (requires strong policy enforcement, dry-runs, human approval hooks)
 *
 * Philosophy: This is NOT "let the LLM drive the browser freely."
 * This is: LLM proposes → MCP constrains → Playwright executes.
 */
import { MCPConnector, MCPStep, MCPConstraints, AuthContext, DryRunResult, ExecutionResult, AuditEvent } from '../types';
import { PlaywrightPolicy } from './policy';
export { PlaywrightPolicy };
interface PlaywrightConfig {
    headless?: boolean;
    timeout?: number;
    screenshotOnError?: boolean;
}
export declare class PlaywrightConnector implements MCPConnector {
    name: string;
    version: string;
    private config;
    private policy;
    private browser;
    private page;
    private executionHistory;
    constructor(config?: PlaywrightConfig, policy?: PlaywrightPolicy);
    authorize(context: Record<string, unknown>): Promise<AuthContext>;
    dryRun(step: MCPStep, constraints: MCPConstraints): Promise<DryRunResult>;
    execute(step: MCPStep, constraints: MCPConstraints): Promise<ExecutionResult>;
    revert(executionId: string): Promise<{
        status: 'success' | 'error' | 'not_revertible';
        message?: string;
    }>;
    auditEvent(result: ExecutionResult): AuditEvent;
    private initializeBrowser;
    private getCurrentUrl;
    private hashString;
    private openUrl;
    private click;
    private type;
    private extractText;
    private screenshot;
    private downloadFile;
    private submitForm;
    private resolveTextReference;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map