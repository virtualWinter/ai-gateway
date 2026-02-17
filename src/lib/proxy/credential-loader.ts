/**
 * Credential loader: builds auth headers based on provider auth type.
 */

import type { ResolvedRoute } from "./router";

export interface AuthHeaders {
    [key: string]: string;
}

/**
 * Build authentication headers for an upstream request.
 */
export function getAuthHeaders(route: ResolvedRoute): AuthHeaders {
    const { provider, oauthAccount } = route;

    switch (provider.authType) {
        case "bearer":
            if (!provider.credentials) return {};
            return { Authorization: `Bearer ${provider.credentials}` };

        case "header": {
            // Custom header format: "X-Api-Key:value" or JSON {"Header":"Value"}
            if (!provider.credentials) return {};
            try {
                return JSON.parse(provider.credentials) as AuthHeaders;
            } catch {
                // Try single header format "HeaderName:Value"
                const colonIdx = provider.credentials.indexOf(":");
                if (colonIdx > 0) {
                    const name = provider.credentials.slice(0, colonIdx).trim();
                    const value = provider.credentials.slice(colonIdx + 1).trim();
                    return { [name]: value };
                }
                return {};
            }
        }

        case "oauth":
            if (!oauthAccount?.accessToken) return {};
            return { Authorization: `Bearer ${oauthAccount.accessToken}` };

        case "none":
        default:
            return {};
    }
}
