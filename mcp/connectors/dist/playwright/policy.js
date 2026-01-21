"use strict";
/**
 * Playwright Policy Enforcement
 *
 * Enforces safety constraints for browser automation actions.
 * This is the "kill switch" and safety boundary layer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightPolicy = void 0;
const url_1 = require("url");
class PlaywrightPolicy {
    /**
     * Validates a step against constraints and safety policies.
     */
    async validate(step, constraints) {
        // 1. URL allowlist check
        const urlCheck = this.checkUrlAllowlist(step, constraints);
        if (!urlCheck.allowed) {
            return urlCheck;
        }
        // 2. Denied actions check
        const actionCheck = this.checkDeniedActions(step, constraints);
        if (!actionCheck.allowed) {
            return actionCheck;
        }
        // 3. Password field protection
        const passwordCheck = this.checkPasswordFields(step);
        if (!passwordCheck.allowed) {
            return passwordCheck;
        }
        // 4. Destructive action check
        const destructiveCheck = this.checkDestructiveActions(step);
        if (!destructiveCheck.allowed) {
            return destructiveCheck;
        }
        // 5. Budget checks
        const budgetCheck = this.checkBudgets(step, constraints);
        if (!budgetCheck.allowed) {
            return budgetCheck;
        }
        return { allowed: true, risk: 'low' };
    }
    /**
     * Checks if the URL is in the allowlist.
     */
    checkUrlAllowlist(step, constraints) {
        const allowlist = constraints.allowlist_domains || [];
        if (allowlist.length === 0) {
            return { allowed: true }; // No allowlist = allow all (for development)
        }
        // Extract URL from step
        let url;
        if (step.action === 'open_url') {
            url = step.input.url;
        }
        else if (step.input.url) {
            url = step.input.url;
        }
        if (!url) {
            return { allowed: true }; // No URL in this step
        }
        try {
            const parsed = new url_1.URL(url);
            const hostname = parsed.hostname.toLowerCase();
            // Check against allowlist rules
            for (const rule of allowlist) {
                const normalizedRule = rule.toLowerCase().trim();
                // Exact match
                if (hostname === normalizedRule) {
                    return { allowed: true };
                }
                // Wildcard subdomain match (*.example.com)
                if (normalizedRule.startsWith('*.')) {
                    const domain = normalizedRule.slice(2);
                    if (hostname === domain || hostname.endsWith('.' + domain)) {
                        return { allowed: true };
                    }
                }
                // Suffix match (example.com matches www.example.com)
                if (hostname === normalizedRule || hostname.endsWith('.' + normalizedRule)) {
                    return { allowed: true };
                }
            }
            return {
                allowed: false,
                reason: `URL host not allowlisted: ${hostname}`,
                risk: 'high',
            };
        }
        catch (error) {
            return {
                allowed: false,
                reason: `Invalid URL: ${url}`,
                risk: 'high',
            };
        }
    }
    /**
     * Checks if the action is in the denied actions list.
     */
    checkDeniedActions(step, constraints) {
        const denied = constraints.deny_actions || [];
        if (denied.length === 0) {
            return { allowed: true };
        }
        const action = step.action.toLowerCase();
        if (denied.includes(action)) {
            return {
                allowed: false,
                reason: `Action denied by policy: ${action}`,
                risk: 'high',
            };
        }
        return { allowed: true };
    }
    /**
     * Checks if the action targets password fields (requires explicit approval).
     */
    checkPasswordFields(step) {
        if (step.action !== 'type' && step.action !== 'click') {
            return { allowed: true };
        }
        const selector = step.input.selector || '';
        const lowerSelector = selector.toLowerCase();
        // Check for common password field indicators
        const passwordIndicators = [
            'password',
            'passwd',
            'pwd',
            '[type="password"]',
            '[name*="password"]',
            '[id*="password"]',
        ];
        for (const indicator of passwordIndicators) {
            if (lowerSelector.includes(indicator)) {
                return {
                    allowed: false,
                    reason: 'Password field detected - requires explicit human approval',
                    risk: 'high',
                };
            }
        }
        return { allowed: true };
    }
    /**
     * Checks if the action is destructive and requires approval.
     */
    checkDestructiveActions(step) {
        const destructiveActions = ['submit_form', 'download_file'];
        const action = step.action.toLowerCase();
        if (destructiveActions.includes(action)) {
            // These require explicit approval flag
            if (!step.requires_human_approval) {
                return {
                    allowed: false,
                    reason: `Destructive action requires explicit human approval: ${action}`,
                    risk: 'high',
                };
            }
        }
        return { allowed: true };
    }
    /**
     * Checks budget constraints (time, steps, etc.).
     */
    checkBudgets(step, constraints) {
        const budget = constraints.budget;
        if (!budget) {
            return { allowed: true };
        }
        // Note: Actual budget tracking would need to be done at a higher level
        // (e.g., in the orchestrator) since we don't have access to execution history here.
        // This is a placeholder that validates the budget structure.
        if (budget.max_time_ms && budget.max_time_ms <= 0) {
            return {
                allowed: false,
                reason: 'Time budget exhausted',
                risk: 'low',
            };
        }
        if (budget.max_steps && budget.max_steps <= 0) {
            return {
                allowed: false,
                reason: 'Step budget exhausted',
                risk: 'low',
            };
        }
        return { allowed: true };
    }
    /**
     * Gets the risk level for an action.
     */
    getActionRisk(action) {
        const lowRisk = ['open_url', 'extract_text'];
        const mediumRisk = ['click', 'screenshot'];
        const highRisk = ['type', 'submit_form', 'download_file'];
        const normalized = action.toLowerCase();
        if (lowRisk.includes(normalized))
            return 'low';
        if (mediumRisk.includes(normalized))
            return 'medium';
        if (highRisk.includes(normalized))
            return 'high';
        return 'high'; // Unknown actions are high risk
    }
}
exports.PlaywrightPolicy = PlaywrightPolicy;
//# sourceMappingURL=policy.js.map