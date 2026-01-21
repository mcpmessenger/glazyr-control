"use strict";
/**
 * Rate Limiting for Google Places API
 *
 * Tracks API usage and enforces rate limits to prevent quota exhaustion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    constructor(config = {}) {
        this.calls = [];
        this.dailyCalls = 0;
        this.lastReset = Date.now();
        this.config = {
            maxCallsPerMinute: config.maxCallsPerMinute || 60,
            maxCallsPerDay: config.maxCallsPerDay || 1000,
            resetInterval: config.resetInterval || 24 * 60 * 60 * 1000, // 24 hours
        };
    }
    canMakeCall() {
        const now = Date.now();
        // Reset daily counter if interval has passed
        if (now - this.lastReset > this.config.resetInterval) {
            this.dailyCalls = 0;
            this.lastReset = now;
        }
        // Check daily limit
        if (this.dailyCalls >= this.config.maxCallsPerDay) {
            const retryAfter = this.config.resetInterval - (now - this.lastReset);
            return {
                allowed: false,
                reason: 'Daily API call limit exceeded',
                retryAfter,
            };
        }
        // Clean old calls (older than 1 minute)
        const oneMinuteAgo = now - 60 * 1000;
        this.calls = this.calls.filter(timestamp => timestamp > oneMinuteAgo);
        // Check per-minute limit
        if (this.calls.length >= this.config.maxCallsPerMinute) {
            const oldestCall = Math.min(...this.calls);
            const retryAfter = 60 * 1000 - (now - oldestCall);
            return {
                allowed: false,
                reason: 'Per-minute API call limit exceeded',
                retryAfter,
            };
        }
        return { allowed: true };
    }
    recordCall() {
        const now = Date.now();
        this.calls.push(now);
        this.dailyCalls++;
    }
    getStats() {
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const callsLastMinute = this.calls.filter(timestamp => timestamp > oneMinuteAgo).length;
        return {
            callsLastMinute,
            callsToday: this.dailyCalls,
            maxPerMinute: this.config.maxCallsPerMinute,
            maxPerDay: this.config.maxCallsPerDay,
        };
    }
    reset() {
        this.calls = [];
        this.dailyCalls = 0;
        this.lastReset = Date.now();
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rateLimit.js.map