/**
 * Centralized environment configuration.
 * Reads and validates all required env vars at import time.
 */

function required(key: string): string {
    const value = process.env[key];
    if (!value) {
        // During next build, some variables might be missing but won't be used
        if (process.env.NEXT_PHASE === "phase-production-build") {
            return "BUILD_DUMMY_VALUE";
        }
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function optional(key: string, fallback: string = ""): string {
    return process.env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : fallback;
}

export const config = {
    // ── Database ───────────────────────────────────────────────
    databaseUrl: required("DATABASE_URL"),

    // ── Encryption ─────────────────────────────────────────────
    encryptionKey: required("ENCRYPTION_KEY"),

    // ── Redis (optional) ──────────────────────────────────────
    redisUrl: optional("REDIS_URL"),

    // ── Google OAuth ──────────────────────────────────────────
    googleClientId: process.env.GOOGLE_CLIENT_ID || "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "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",
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",
    googleScopes: process.env.GOOGLE_SCOPES || "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs",

    // ── OpenAI OAuth ──────────────────────────────────────────
    openaiClientId: optional("OPENAI_CLIENT_ID"),
    openaiRedirectUri: optional(
        "OPENAI_REDIRECT_URI"
    ),

    // ── Rate Limiting ─────────────────────────────────────────
    rateLimitWindowMs: optionalInt("RATE_LIMIT_WINDOW_MS", 60_000),
    rateLimitMaxRequests: optionalInt("RATE_LIMIT_MAX_REQUESTS", 60),
    globalRateLimitMaxRequests: optionalInt("GLOBAL_RATE_LIMIT_MAX", 1000),

    // ── SSRF Protection ───────────────────────────────────────
    allowedUpstreamHosts: optional(
        "ALLOWED_UPSTREAM_HOSTS",
        "api.openai.com,generativelanguage.googleapis.com,api.anthropic.com,oauth2.googleapis.com,auth.openai.com,www.googleapis.com"
    )
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
    disableSsrfProtection: optional("DISABLE_SSRF_PROTECTION") === "true",

    // ── Admin Auth ────────────────────────────────────────────
    adminSessionTtlHours: optionalInt("ADMIN_SESSION_TTL_HOURS", 168), // 7 days

    // ── App ─────────────────────────────────────────────────
    nodeEnv: optional("NODE_ENV", "development"),
    baseUrl: optional("BASE_URL", "http://localhost:4000"),
} as const;
