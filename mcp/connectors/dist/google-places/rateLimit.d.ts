/**
 * Rate Limiting for Google Places API
 *
 * Tracks API usage and enforces rate limits to prevent quota exhaustion.
 */
export interface RateLimitConfig {
    maxCallsPerMinute?: number;
    maxCallsPerDay?: number;
    resetInterval?: number;
}
export declare class RateLimiter {
    private calls;
    private dailyCalls;
    private lastReset;
    private config;
    constructor(config?: RateLimitConfig);
    canMakeCall(): {
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
    };
    recordCall(): void;
    getStats(): {
        callsLastMinute: number;
        callsToday: number;
        maxPerMinute: number;
        maxPerDay: number;
    };
    reset(): void;
}
//# sourceMappingURL=rateLimit.d.ts.map