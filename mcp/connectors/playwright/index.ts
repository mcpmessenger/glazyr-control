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
import * as crypto from 'crypto';

export { PlaywrightPolicy };

interface PlaywrightConfig {
  headless?: boolean;
  timeout?: number;
  screenshotOnError?: boolean;
}

interface OpenUrlInput {
  url: string;
}

interface ClickInput {
  selector: string;
  wait_for_selector?: string;
}

interface TypeInput {
  selector: string;
  text_ref?: string; // Reference to secure vault value
  text?: string; // Direct text (lower security)
  clear?: boolean;
}

interface ExtractTextInput {
  selector?: string; // If omitted, extracts all visible text
}

interface ScreenshotInput {
  full_page?: boolean;
  selector?: string; // If provided, screenshots only this element
}

interface DownloadFileInput {
  url: string;
  selector?: string; // Click this selector to trigger download
}

interface SubmitFormInput {
  selector: string;
}

export class PlaywrightConnector implements MCPConnector {
  name = 'playwright';
  version = '1.0.0';
  private config: PlaywrightConfig;
  private policy: PlaywrightPolicy;
  private browser: any = null; // Playwright Browser instance
  private page: any = null; // Playwright Page instance
  private executionHistory: Map<string, ExecutionResult> = new Map();

  constructor(config: PlaywrightConfig = {}, policy?: PlaywrightPolicy) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      screenshotOnError: config.screenshotOnError !== false,
    };
    this.policy = policy || new PlaywrightPolicy();
  }

  async authorize(context: Record<string, unknown>): Promise<AuthContext> {
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
    } catch (error) {
      return {
        authenticated: false,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async dryRun(step: MCPStep, constraints: MCPConstraints): Promise<DryRunResult> {
    const action = step.action.toLowerCase();
    const warnings: string[] = [];
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
    let estimatedRisk: 'low' | 'medium' | 'high' = 'low';
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

  async execute(step: MCPStep, constraints: MCPConstraints): Promise<ExecutionResult> {
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
      let output: Record<string, unknown>;
      let screenshotHash: string | undefined;
      let domSnapshotHash: string | undefined;

      switch (action) {
        case 'open_url':
          output = await this.openUrl(step.input as unknown as OpenUrlInput);
          break;
        case 'click':
          output = await this.click(step.input as unknown as ClickInput);
          break;
        case 'type':
          output = await this.type(step.input as unknown as TypeInput);
          break;
        case 'extract_text':
          output = await this.extractText(step.input as unknown as ExtractTextInput);
          break;
        case 'screenshot':
          const screenshotResult = await this.screenshot(step.input as unknown as ScreenshotInput);
          output = screenshotResult.output;
          screenshotHash = screenshotResult.hash;
          break;
        case 'download_file':
          output = await this.downloadFile(step.input as unknown as DownloadFileInput);
          break;
        case 'submit_form':
          output = await this.submitForm(step.input as unknown as SubmitFormInput);
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
      const result: ExecutionResult = {
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
    } catch (error) {
      // Capture error screenshot if enabled
      let errorScreenshotHash: string | undefined;
      if (this.config.screenshotOnError && this.page) {
        try {
          const screenshot = await this.page.screenshot({ encoding: 'base64' });
          errorScreenshotHash = this.hashString(screenshot);
        } catch {
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

  async revert(executionId: string): Promise<{ status: 'success' | 'error' | 'not_revertible'; message?: string }> {
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
      } catch (error) {
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

  auditEvent(result: ExecutionResult): AuditEvent {
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

  private async initializeBrowser(): Promise<void> {
    const { chromium } = require('playwright');
    this.browser = await chromium.launch({ headless: this.config.headless });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(this.config.timeout);
  }

  private async getCurrentUrl(): Promise<string> {
    if (!this.page) return '';
    return await this.page.url();
  }

  private hashString(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async openUrl(input: OpenUrlInput): Promise<Record<string, unknown>> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.goto(input.url, { waitUntil: 'networkidle' });
    return {
      navigated: true,
      url: input.url,
    };
  }

  private async click(input: ClickInput): Promise<Record<string, unknown>> {
    if (!this.page) throw new Error('Browser not initialized');
    if (input.wait_for_selector) {
      await this.page.waitForSelector(input.wait_for_selector);
    }
    await this.page.click(input.selector);
    return {
      clicked: true,
      selector: input.selector,
    };
  }

  private async type(input: TypeInput): Promise<Record<string, unknown>> {
    if (!this.page) throw new Error('Browser not initialized');
    
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

  private async extractText(input: ExtractTextInput): Promise<Record<string, unknown>> {
    if (!this.page) throw new Error('Browser not initialized');
    
    if (input.selector) {
      const element = await this.page.$(input.selector);
      const text = element ? await element.textContent() : '';
      return { text, selector: input.selector };
    } else {
      const text = await this.page.textContent('body');
      return { text };
    }
  }

  private async screenshot(input: ScreenshotInput): Promise<{ output: Record<string, unknown>; hash: string }> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const options: any = {};
    if (input.full_page) {
      options.fullPage = true;
    }
    
    let screenshot: Buffer;
    if (input.selector) {
      const element = await this.page.$(input.selector);
      if (!element) throw new Error(`Selector not found: ${input.selector}`);
      screenshot = await element.screenshot(options);
    } else {
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

  private async downloadFile(input: DownloadFileInput): Promise<Record<string, unknown>> {
    if (!this.page) throw new Error('Browser not initialized');
    
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
    } else {
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

  private async submitForm(input: SubmitFormInput): Promise<Record<string, unknown>> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.click(input.selector);
    return {
      submitted: true,
      selector: input.selector,
    };
  }

  private async resolveTextReference(ref: string): Promise<string> {
    // In production, this would resolve from a secure vault
    // The connector never receives raw secrets, only references
    // This should be implemented by the extension or secure vault service
    return process.env[`TEXT_REF_${ref}`] || '';
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
