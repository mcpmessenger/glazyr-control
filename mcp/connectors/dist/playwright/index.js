"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightConnector = exports.PlaywrightPolicy = void 0;
const policy_1 = require("./policy");
Object.defineProperty(exports, "PlaywrightPolicy", { enumerable: true, get: function () { return policy_1.PlaywrightPolicy; } });
const crypto = __importStar(require("crypto"));
class PlaywrightConnector {
    constructor(config = {}, policy) {
        this.name = 'playwright';
        this.version = '1.0.0';
        this.browser = null; // Playwright Browser instance
        this.page = null; // Playwright Page instance
        this.executionHistory = new Map();
        this.config = {
            headless: config.headless !== false,
            timeout: config.timeout || 30000,
            screenshotOnError: config.screenshotOnError !== false,
        };
        this.policy = policy || new policy_1.PlaywrightPolicy();
    }
    async authorize(context) {
        // Playwright runs locally, so authorization is about environment readiness
        // Check if Playwright is available and browser can be launched
        try {
            // In a real implementation, this would check Playwright installation
            // For now, we assume it's available if we reach this point
            return {
                authenticated: true,
                metadata: {
                    headless: this.config.headless,
                    timeout: this.config.timeout,
                },
            };
        }
        catch (error) {
            return {
                authenticated: false,
                metadata: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }
    async dryRun(step, constraints) {
        const action = step.action.toLowerCase();
        const warnings = [];
        let requiresApproval = false;
        // Validate action is supported
        const supportedActions = ['open_url', 'click', 'type', 'submit_form', 'extract_text', 'screenshot', 'download_file'];
        if (!supportedActions.includes(action)) {
            return {
                allowed: false,
                reason: `Unsupported action: ${action}`,
                estimatedRisk: 'high',
            };
        }
        // Policy checks
        const policyCheck = await this.policy.validate(step, constraints);
        if (!policyCheck.allowed) {
            return {
                allowed: false,
                reason: policyCheck.reason || 'Policy violation',
                estimatedRisk: policyCheck.risk || 'high',
                requiresHumanApproval: true,
            };
        }
        // Risk assessment by action type
        let estimatedRisk = 'low';
        switch (action) {
            case 'open_url':
                estimatedRisk = 'low';
                break;
            case 'extract_text':
                estimatedRisk = 'low';
                break;
            case 'screenshot':
                estimatedRisk = 'medium';
                break;
            case 'click':
                estimatedRisk = 'medium';
                requiresApproval = constraints.human_approval_required || false;
                break;
            case 'type':
                estimatedRisk = 'high';
                requiresApproval = true; // Always require approval for typing (PII risk)
                if (step.input.text_ref) {
                    warnings.push('Text reference detected - ensure secure vault resolution');
                }
                break;
            case 'submit_form':
                estimatedRisk = 'high';
                requiresApproval = true;
                warnings.push('Form submission is a high-risk action');
                break;
            case 'download_file':
                estimatedRisk = 'high';
                requiresApproval = true;
                warnings.push('File download requires explicit approval');
                break;
        }
        // Budget checks
        if (constraints.budget) {
            if (constraints.budget.max_steps && this.executionHistory.size >= constraints.budget.max_steps) {
                return {
                    allowed: false,
                    reason: 'Maximum steps budget exceeded',
                    estimatedRisk: 'low',
                };
            }
            if (constraints.budget.max_time_ms) {
                warnings.push(`Time budget: ${constraints.budget.max_time_ms}ms`);
            }
        }
        return {
            allowed: true,
            estimatedRisk,
            requiresHumanApproval: requiresApproval || constraints.human_approval_required || false,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
    async execute(step, constraints) {
        const startTime = Date.now();
        const action = step.action.toLowerCase();
        try {
            // Dry run check first
            const dryRun = await this.dryRun(step, constraints);
            if (!dryRun.allowed) {
                return {
                    status: 'blocked',
                    step_id: step.step_id,
                    error: dryRun.reason || 'Execution blocked by dry run',
                };
            }
            // Check if human approval is required
            if (dryRun.requiresHumanApproval && !step.requires_human_approval) {
                return {
                    status: 'blocked',
                    step_id: step.step_id,
                    error: 'Human approval required but not provided',
                };
            }
            // Initialize browser if needed
            if (!this.browser) {
                await this.initializeBrowser();
            }
            // Execute action
            let output;
            let screenshotHash;
            let domSnapshotHash;
            switch (action) {
                case 'open_url':
                    output = await this.openUrl(step.input);
                    break;
                case 'click':
                    output = await this.click(step.input);
                    break;
                case 'type':
                    output = await this.type(step.input);
                    break;
                case 'extract_text':
                    output = await this.extractText(step.input);
                    break;
                case 'screenshot':
                    const screenshotResult = await this.screenshot(step.input);
                    output = screenshotResult.output;
                    screenshotHash = screenshotResult.hash;
                    break;
                case 'download_file':
                    output = await this.downloadFile(step.input);
                    break;
                case 'submit_form':
                    output = await this.submitForm(step.input);
                    break;
                default:
                    return {
                        status: 'error',
                        step_id: step.step_id,
                        error: `Unsupported action: ${action}`,
                    };
            }
            // Capture DOM snapshot for audit
            if (this.page) {
                const domSnapshot = await this.page.content();
                domSnapshotHash = this.hashString(domSnapshot);
            }
            const duration = Date.now() - startTime;
            const result = {
                status: 'success',
                step_id: step.step_id,
                output,
                telemetry: {
                    duration_ms: duration,
                    url: await this.getCurrentUrl(),
                },
                proof: {
                    screenshot_hash: screenshotHash,
                    dom_snapshot_hash: domSnapshotHash,
                },
            };
            // Store in history
            this.executionHistory.set(step.step_id, result);
            return result;
        }
        catch (error) {
            // Capture error screenshot if enabled
            let errorScreenshotHash;
            if (this.config.screenshotOnError && this.page) {
                try {
                    const screenshot = await this.page.screenshot({ encoding: 'base64' });
                    errorScreenshotHash = this.hashString(screenshot);
                }
                catch {
                    // Ignore screenshot errors
                }
            }
            return {
                status: 'error',
                step_id: step.step_id,
                error: error instanceof Error ? error.message : 'Unknown error',
                telemetry: {
                    duration_ms: Date.now() - startTime,
                },
                proof: {
                    screenshot_hash: errorScreenshotHash,
                },
            };
        }
    }
    async revert(executionId) {
        // Most browser actions are not easily revertible
        // Navigation can be reverted by going back
        const result = this.executionHistory.get(executionId);
        if (!result) {
            return {
                status: 'error',
                message: 'Execution not found in history',
            };
        }
        // Only navigation actions can be reverted
        if (result.output?.action === 'open_url' && this.page) {
            try {
                await this.page.goBack();
                return {
                    status: 'success',
                    message: 'Navigation reverted',
                };
            }
            catch (error) {
                return {
                    status: 'error',
                    message: error instanceof Error ? error.message : 'Failed to revert',
                };
            }
        }
        return {
            status: 'not_revertible',
            message: 'This action cannot be reverted',
        };
    }
    auditEvent(result) {
        return {
            timestamp: Date.now(),
            connector: this.name,
            step_id: result.step_id,
            action: 'execute',
            status: result.status,
            metadata: {
                telemetry: result.telemetry,
                proof: result.proof,
            },
        };
    }
    // Private helper methods
    async initializeBrowser() {
        const { chromium } = require('playwright');
        this.browser = await chromium.launch({ headless: this.config.headless });
        this.page = await this.browser.newPage();
        this.page.setDefaultTimeout(this.config.timeout);
    }
    async getCurrentUrl() {
        if (!this.page)
            return '';
        return await this.page.url();
    }
    hashString(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    async openUrl(input) {
        if (!this.page)
            throw new Error('Browser not initialized');
        await this.page.goto(input.url, { waitUntil: 'networkidle' });
        return {
            navigated: true,
            url: input.url,
        };
    }
    async click(input) {
        if (!this.page)
            throw new Error('Browser not initialized');
        if (input.wait_for_selector) {
            await this.page.waitForSelector(input.wait_for_selector);
        }
        await this.page.click(input.selector);
        return {
            clicked: true,
            selector: input.selector,
        };
    }
    async type(input) {
        if (!this.page)
            throw new Error('Browser not initialized');
        // Resolve text from secure vault if reference provided
        let text = input.text || '';
        if (input.text_ref) {
            text = await this.resolveTextReference(input.text_ref);
        }
        if (!text) {
            throw new Error('No text provided and text_ref could not be resolved');
        }
        if (input.clear) {
            await this.page.fill(input.selector, '');
        }
        await this.page.fill(input.selector, text);
        return {
            typed: true,
            selector: input.selector,
            text_length: text.length,
            // Never return actual text in output (PII protection)
        };
    }
    async extractText(input) {
        if (!this.page)
            throw new Error('Browser not initialized');
        if (input.selector) {
            const element = await this.page.$(input.selector);
            const text = element ? await element.textContent() : '';
            return { text, selector: input.selector };
        }
        else {
            const text = await this.page.textContent('body');
            return { text };
        }
    }
    async screenshot(input) {
        if (!this.page)
            throw new Error('Browser not initialized');
        const options = {};
        if (input.full_page) {
            options.fullPage = true;
        }
        let screenshot;
        if (input.selector) {
            const element = await this.page.$(input.selector);
            if (!element)
                throw new Error(`Selector not found: ${input.selector}`);
            screenshot = await element.screenshot(options);
        }
        else {
            screenshot = await this.page.screenshot(options);
        }
        const screenshotBase64 = screenshot.toString('base64');
        const hash = this.hashString(screenshotBase64);
        return {
            output: {
                screenshot_captured: true,
                full_page: input.full_page || false,
                selector: input.selector,
                screenshot_hash: hash,
            },
            hash,
        };
    }
    async downloadFile(input) {
        if (!this.page)
            throw new Error('Browser not initialized');
        if (input.selector) {
            const [download] = await Promise.all([
                this.page.waitForEvent('download'),
                this.page.click(input.selector),
            ]);
            const path = await download.path();
            return {
                downloaded: true,
                url: input.url,
                path: path, // In production, return safe path reference
            };
        }
        else {
            await this.page.goto(input.url);
            const [download] = await Promise.all([
                this.page.waitForEvent('download'),
            ]);
            const path = await download.path();
            return {
                downloaded: true,
                url: input.url,
                path: path, // In production, return safe path reference
            };
        }
    }
    async submitForm(input) {
        if (!this.page)
            throw new Error('Browser not initialized');
        await this.page.click(input.selector);
        return {
            submitted: true,
            selector: input.selector,
        };
    }
    async resolveTextReference(ref) {
        // In production, this would resolve from a secure vault
        // The connector never receives raw secrets, only references
        // This should be implemented by the extension or secure vault service
        return process.env[`TEXT_REF_${ref}`] || '';
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
exports.PlaywrightConnector = PlaywrightConnector;
//# sourceMappingURL=index.js.map