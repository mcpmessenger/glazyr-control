/**
 * Playwright Policy Enforcement
 *
 * Enforces safety constraints for browser automation actions.
 * This is the "kill switch" and safety boundary layer.
 */
import { MCPStep, MCPConstraints } from '../types';
export interface PolicyCheckResult {
    allowed: boolean;
    reason?: string;
    risk?: 'low' | 'medium' | 'high';
}
export declare class PlaywrightPolicy {
    /**
     * Validates a step against constraints and safety policies.
     */
    validate(step: MCPStep, constraints: MCPConstraints): Promise<PolicyCheckResult>;
    /**
     * Checks if the URL is in the allowlist.
     */
    private checkUrlAllowlist;
    /**
     * Checks if the action is in the denied actions list.
     */
    private checkDeniedActions;
    /**
     * Checks if the action targets password fields (requires explicit approval).
     */
    private checkPasswordFields;
    /**
     * Checks if the action is destructive and requires approval.
     */
    private checkDestructiveActions;
    /**
     * Checks budget constraints (time, steps, etc.).
     */
    private checkBudgets;
    /**
     * Gets the risk level for an action.
     */
    getActionRisk(action: string): 'low' | 'medium' | 'high';
}
//# sourceMappingURL=policy.d.ts.map