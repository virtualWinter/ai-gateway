/**
 * SSRF protection: validates upstream provider base URLs.
 */

import { createLogger } from "@/lib/logger";
import { config } from "@/lib/config";

const log = createLogger("ssrf");

// Private/internal IP ranges that must be blocked
const PRIVATE_IP_PATTERNS = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./, // Link-local
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
    /^fd/,
    /^localhost$/i,
];

/**
 * Parse allowed hosts from the ALLOWED_UPSTREAM_HOSTS env var.
 */
function getAllowedHosts(): Set<string> {
    const raw =
        process.env.ALLOWED_UPSTREAM_HOSTS ||
        "api.openai.com,generativelanguage.googleapis.com,api.anthropic.com,oauth2.googleapis.com,auth.openai.com,www.googleapis.com";
    return new Set(
        raw
            .split(",")
            .map((h) => h.trim().toLowerCase())
            .filter(Boolean)
    );
}

/**
 * Check if a hostname matches private/internal IP patterns.
 */
function isPrivateHost(hostname: string): boolean {
    return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Validate that a base URL is allowed for upstream requests.
 * Rejects private IPs and hosts not in the allowlist.
 */
export function validateBaseUrl(baseUrl: string): {
    valid: boolean;
    reason?: string;
} {
    try {
        const url = new URL(baseUrl);

        if (config.disableSsrfProtection) {
            return { valid: true };
        }

        // Must be HTTPS in production
        if (
            process.env.NODE_ENV === "production" &&
            url.protocol !== "https:"
        ) {
            return { valid: false, reason: "HTTPS required in production" };
        }

        // Block private/internal IPs
        if (isPrivateHost(url.hostname)) {
            log.warn("Blocked SSRF attempt to private host", {
                hostname: url.hostname,
            });
            return { valid: false, reason: "Private/internal hosts not allowed" };
        }

        // Check allowlist
        const allowed = getAllowedHosts();
        if (allowed.size > 0 && !allowed.has(url.hostname.toLowerCase())) {
            log.warn("Blocked request to non-allowlisted host", {
                hostname: url.hostname,
            });
            return { valid: false, reason: `Host '${url.hostname}' not in allowlist` };
        }

        return { valid: true };
    } catch {
        return { valid: false, reason: "Invalid URL" };
    }
}
