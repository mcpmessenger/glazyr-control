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
export declare class PlaywrightAuditLogger {
    private logs;
    private maxLogs;
    /**
     * Creates an audit log entry from an execution result.
     */
    createAuditEntry(result: ExecutionResult, action: string, riskLevel: 'low' | 'medium' | 'high', metadata?: Record<string, unknown>): AuditLogEntry;
    /**
     * Adds a log entry (with rotation if needed).
     */
    private addLog;
    /**
     * Gets all audit logs.
     */
    getLogs(): AuditLogEntry[];
    /**
     * Gets audit logs for a specific step.
     */
    getLogsForStep(stepId: string): AuditLogEntry[];
    /**
     * Gets audit logs within a time range.
     */
    getLogsInRange(startTime: number, endTime: number): AuditLogEntry[];
    /**
     * Gets audit logs by risk level.
     */
    getLogsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): AuditLogEntry[];
    /**
     * Clears all audit logs.
     */
    clear(): void;
    /**
     * Exports audit logs as JSON (for compliance/backup).
     */
    export(): string;
    /**
     * Imports audit logs from JSON.
     */
    import(json: string): void;
}
//# sourceMappingURL=audit.d.ts.map