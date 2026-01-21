/**
 * Google Places MCP Connector
 *
 * Role: Trusted sensory input - provides grounded, external truth about businesses,
 * locations, ratings, hours, and Place IDs.
 *
 * Risk Level: Low (read-heavy, no destructive actions)
 */
import { MCPConnector, MCPStep, MCPConstraints, AuthContext, DryRunResult, ExecutionResult, AuditEvent } from '../types';
interface GooglePlacesConfig {
    apiKey?: string;
    apiKeyRef?: string;
}
export declare class GooglePlacesConnector implements MCPConnector {
    name: string;
    version: string;
    private config;
    private apiCallsUsed;
    constructor(config?: GooglePlacesConfig);
    authorize(context: Record<string, unknown>): Promise<AuthContext>;
    dryRun(step: MCPStep, constraints: MCPConstraints): Promise<DryRunResult>;
    execute(step: MCPStep, constraints: MCPConstraints): Promise<ExecutionResult>;
    auditEvent(result: ExecutionResult): AuditEvent;
    private getApiKey;
    private resolveApiKey;
    private validateInput;
    private placesSearch;
    private placeDetails;
    private placePhotos;
    private placeHours;
    private placeReviews;
}
export {};
//# sourceMappingURL=index.d.ts.map