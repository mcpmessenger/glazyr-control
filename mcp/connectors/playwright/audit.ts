/**
 * Audit Logging for Playwright Connector
 * 
 * Provides structured audit events for compliance and debugging.
 */

import { ExecutionResult, AuditEvent } from '../types';

export interface AuditLogEntry extends AuditEvent {
  action_type: string;
  risk_level: 'low' | 'medium' | 'high';
  url?: string;
  selector?: string;
  proof_hashes?: {
    screenshot?: string;
    dom_snapshot?: string;
  };
}

export class PlaywrightAuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs = 1000; // Prevent memory bloat

  /**
   * Creates an audit log entry from an execution result.
   */
  createAuditEntry(
    result: ExecutionResult,
    action: string,
    riskLevel: 'low' | 'medium' | 'high',
    metadata?: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      connector: 'playwright',
      step_id: result.step_id,
      action,
      status: result.status,
      action_type: action,
      risk_level: riskLevel,
      url: result.telemetry?.url as string | undefined,
      selector: result.output?.selector as string | undefined,
      proof_hashes: result.proof ? {
        screenshot: result.proof.screenshot_hash,
        dom_snapshot: result.proof.dom_snapshot_hash,
      } : undefined,
      metadata: {
        ...metadata,
        telemetry: result.telemetry,
      },
    };

    this.addLog(entry);
    return entry;
  }

  /**
   * Adds a log entry (with rotation if needed).
   */
  private addLog(entry: AuditLogEntry): void {
    this.logs.push(entry);
    
    // Rotate if too many logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Gets all audit logs.
   */
  getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  /**
   * Gets audit logs for a specific step.
   */
  getLogsForStep(stepId: string): AuditLogEntry[] {
    return this.logs.filter(log => log.step_id === stepId);
  }

  /**
   * Gets audit logs within a time range.
   */
  getLogsInRange(startTime: number, endTime: number): AuditLogEntry[] {
    return this.logs.filter(log => log.timestamp >= startTime && log.timestamp <= endTime);
  }

  /**
   * Gets audit logs by risk level.
   */
  getLogsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): AuditLogEntry[] {
    return this.logs.filter(log => log.risk_level === riskLevel);
  }

  /**
   * Clears all audit logs.
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Exports audit logs as JSON (for compliance/backup).
   */
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Imports audit logs from JSON.
   */
  import(json: string): void {
    try {
      const imported = JSON.parse(json) as AuditLogEntry[];
      if (Array.isArray(imported)) {
        this.logs = imported.slice(-this.maxLogs);
      }
    } catch (error) {
      throw new Error(`Failed to import audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
