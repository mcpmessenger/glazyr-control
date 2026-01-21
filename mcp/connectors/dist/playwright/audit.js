"use strict";
/**
 * Audit Logging for Playwright Connector
 *
 * Provides structured audit events for compliance and debugging.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightAuditLogger = void 0;
class PlaywrightAuditLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Prevent memory bloat
    }
    /**
     * Creates an audit log entry from an execution result.
     */
    createAuditEntry(result, action, riskLevel, metadata) {
        const entry = {
            timestamp: Date.now(),
            connector: 'playwright',
            step_id: result.step_id,
            action,
            status: result.status,
            action_type: action,
            risk_level: riskLevel,
            url: result.telemetry?.url,
            selector: result.output?.selector,
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
    addLog(entry) {
        this.logs.push(entry);
        // Rotate if too many logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }
    /**
     * Gets all audit logs.
     */
    getLogs() {
        return [...this.logs];
    }
    /**
     * Gets audit logs for a specific step.
     */
    getLogsForStep(stepId) {
        return this.logs.filter(log => log.step_id === stepId);
    }
    /**
     * Gets audit logs within a time range.
     */
    getLogsInRange(startTime, endTime) {
        return this.logs.filter(log => log.timestamp >= startTime && log.timestamp <= endTime);
    }
    /**
     * Gets audit logs by risk level.
     */
    getLogsByRiskLevel(riskLevel) {
        return this.logs.filter(log => log.risk_level === riskLevel);
    }
    /**
     * Clears all audit logs.
     */
    clear() {
        this.logs = [];
    }
    /**
     * Exports audit logs as JSON (for compliance/backup).
     */
    export() {
        return JSON.stringify(this.logs, null, 2);
    }
    /**
     * Imports audit logs from JSON.
     */
    import(json) {
        try {
            const imported = JSON.parse(json);
            if (Array.isArray(imported)) {
                this.logs = imported.slice(-this.maxLogs);
            }
        }
        catch (error) {
            throw new Error(`Failed to import audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.PlaywrightAuditLogger = PlaywrightAuditLogger;
//# sourceMappingURL=audit.js.map