/**
 * Sliding window rate limiter.
 * In-memory implementation with per-key and global limits.
 * Can be swapped for Redis-backed implementation via REDIS_URL.
 */

interface WindowEntry {
    count: number;
    windowStart: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

class SlidingWindowRateLimiter {
    private windows = new Map<string, WindowEntry>();
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor() {
        // Clean stale entries every 60s
        this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    }

    check(
        key: string,
        maxRequests: number,
        windowMs: number
    ): RateLimitResult {
        const now = Date.now();
        const entry = this.windows.get(key);

        if (!entry || now - entry.windowStart >= windowMs) {
            // Start a new window
            this.windows.set(key, { count: 1, windowStart: now });
            return {
                allowed: true,
                remaining: maxRequests - 1,
                resetAt: now + windowMs,
            };
        }

        if (entry.count >= maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: entry.windowStart + windowMs,
            };
        }

        entry.count++;
        return {
            allowed: true,
            remaining: maxRequests - entry.count,
            resetAt: entry.windowStart + windowMs,
        };
    }

    private cleanup() {
        const now = Date.now();
        const maxAge = 300_000; // 5 minutes
        for (const [key, entry] of this.windows) {
            if (now - entry.windowStart > maxAge) {
                this.windows.delete(key);
            }
        }
    }

    destroy() {
        clearInterval(this.cleanupInterval);
    }
}

// Global singleton
const limiter = new SlidingWindowRateLimiter();

/**
 * Check per-key rate limit.
 */
export function checkRateLimit(
    apiKeyId: string,
    maxRequests: number,
    windowMs: number
): RateLimitResult {
    return limiter.check(`key:${apiKeyId}`, maxRequests, windowMs);
}

/**
 * Check global rate limit (across all keys).
 */
export function checkGlobalRateLimit(
    maxRequests: number,
    windowMs: number
): RateLimitResult {
    return limiter.check("global", maxRequests, windowMs);
}
