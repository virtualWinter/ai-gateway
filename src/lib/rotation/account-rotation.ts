/**
 * Account rotation engine with health scoring and LRU selection.
 * Adapted from reference repository patterns.
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("rotation");

// ── Health Score Configuration ─────────────────────────────────────────────

const INITIAL_HEALTH_SCORE = 70;
const MAX_HEALTH_SCORE = 100;
const MIN_USABLE_SCORE = 20;
const SUCCESS_REWARD = 2;
const FAILURE_PENALTY = 15;
const RATE_LIMIT_PENALTY = 25;
const RECOVERY_RATE = 1; // Points recovered per minute

// ── In-memory health tracking ──────────────────────────────────────────────

interface HealthState {
    score: number;
    lastUpdate: number;
    lastUsed: number;
}

const healthMap = new Map<string, HealthState>();

function getHealthState(accountId: string): HealthState {
    let state = healthMap.get(accountId);
    if (!state) {
        state = {
            score: INITIAL_HEALTH_SCORE,
            lastUpdate: Date.now(),
            lastUsed: 0,
        };
        healthMap.set(accountId, state);
    }

    // Apply passive recovery
    const now = Date.now();
    const minutesSinceUpdate = (now - state.lastUpdate) / 60_000;
    if (minutesSinceUpdate > 0) {
        state.score = Math.min(
            MAX_HEALTH_SCORE,
            state.score + minutesSinceUpdate * RECOVERY_RATE
        );
        state.lastUpdate = now;
    }

    return state;
}

/** Record a successful request for an account */
export function recordSuccess(accountId: string): void {
    const state = getHealthState(accountId);
    state.score = Math.min(MAX_HEALTH_SCORE, state.score + SUCCESS_REWARD);
    state.lastUpdate = Date.now();
}

/** Record a failed request for an account */
export function recordFailure(accountId: string): void {
    const state = getHealthState(accountId);
    state.score = Math.max(0, state.score - FAILURE_PENALTY);
    state.lastUpdate = Date.now();
}

/** Record a rate limit hit for an account */
export function recordRateLimit(accountId: string): void {
    const state = getHealthState(accountId);
    state.score = Math.max(0, state.score - RATE_LIMIT_PENALTY);
    state.lastUpdate = Date.now();
}

// ── Account Selection ──────────────────────────────────────────────────────

type OAuthAccountRow = typeof oauthAccounts.$inferSelect;

/**
 * Select the best OAuth account for a provider.
 * Uses a hybrid of health score and LRU recency.
 */
export async function selectBestAccount(
    providerId: string
): Promise<OAuthAccountRow | null> {
    const accounts = await db
        .select()
        .from(oauthAccounts)
        .where(
            and(
                eq(oauthAccounts.providerId, providerId),
                eq(oauthAccounts.isActive, true)
            )
        )
        .orderBy(asc(oauthAccounts.lastUsedAt));

    if (accounts.length === 0) return null;

    // Filter to usable accounts (health above threshold)
    const usable = accounts.filter((acc) => {
        const health = getHealthState(acc.id);
        return health.score >= MIN_USABLE_SCORE;
    });

    if (usable.length === 0) {
        // All accounts unhealthy — use the healthiest one anyway
        log.warn("All OAuth accounts below health threshold, using healthiest", {
            providerId,
        });
        return accounts.reduce((best, acc) => {
            const bestScore = getHealthState(best.id).score;
            const accScore = getHealthState(acc.id).score;
            return accScore > bestScore ? acc : best;
        });
    }

    // Hybrid score: 60% health + 40% LRU (inverse recency)
    const now = Date.now();
    const scored = usable.map((acc) => {
        const health = getHealthState(acc.id);
        const recencyMs = now - health.lastUsed;
        const recencyScore = Math.min(100, recencyMs / 60_000); // Max 100 after 100min

        const totalScore = health.score * 0.6 + recencyScore * 0.4;
        return { account: acc, totalScore };
    });

    // Select the best
    scored.sort((a, b) => b.totalScore - a.totalScore);
    const selected = scored[0].account;

    // Mark as used
    const state = getHealthState(selected.id);
    state.lastUsed = now;

    // Update lastUsedAt in DB (non-blocking)
    db.update(oauthAccounts)
        .set({ lastUsedAt: new Date() })
        .where(eq(oauthAccounts.id, selected.id))
        .then(() => { })
        .catch((err: unknown) => log.error("Failed to update lastUsedAt", { error: String(err) }));

    return selected;
}

// ── Token Refresh ──────────────────────────────────────────────────────────

/**
 * Refresh an OAuth token if expired.
 * Returns the (possibly refreshed) account row.
 */
export async function refreshIfExpired(
    account: OAuthAccountRow,
    providerType: string
): Promise<OAuthAccountRow> {
    // Check if token is still valid (with 5-minute buffer)
    const bufferMs = 5 * 60_000;
    if (account.expiresAt.getTime() > Date.now() + bufferMs) {
        return account;
    }

    log.info("Refreshing expired OAuth token", {
        accountId: account.id,
        providerType,
    });

    const refreshToken = decrypt(account.encryptedRefreshToken);

    let result: { access_token: string; expires_in: number; refresh_token?: string };

    if (providerType === "google" || providerType === "oauth") {
        result = await refreshGoogleToken(refreshToken);
    } else if (providerType === "openai") {
        result = await refreshOpenAIToken(refreshToken);
    } else {
        throw new Error(`Unsupported OAuth provider type: ${providerType}`);
    }

    const newExpiresAt = new Date(Date.now() + result.expires_in * 1000);
    const encryptedAccessToken = encrypt(result.access_token);
    const encryptedRefreshToken = result.refresh_token
        ? encrypt(result.refresh_token)
        : account.encryptedRefreshToken;

    await db
        .update(oauthAccounts)
        .set({
            encryptedAccessToken,
            encryptedRefreshToken,
            expiresAt: newExpiresAt,
        })
        .where(eq(oauthAccounts.id, account.id));

    return {
        ...account,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt: newExpiresAt,
    };
}

async function refreshGoogleToken(
    combinedToken: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
    const { config } = await import("@/lib/config");
    const clientId = config.googleClientId;
    const clientSecret = config.googleClientSecret;

    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials not configured");
    }

    const [refreshToken] = combinedToken.split("|");

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google token refresh failed: ${error}`);
    }

    const data = await response.json();

    // If we got a new refresh token, we need to preserve the projectId
    if (data.refresh_token && combinedToken.includes("|")) {
        const projectId = combinedToken.split("|")[1];
        data.refresh_token = `${data.refresh_token}|${projectId}`;
    }

    return data;
}

async function refreshOpenAIToken(
    refreshToken: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
    const clientId = process.env.OPENAI_CLIENT_ID;

    if (!clientId) {
        throw new Error("OpenAI OAuth credentials not configured");
    }

    const response = await fetch("https://auth.openai.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI token refresh failed: ${error}`);
    }

    return response.json();
}
