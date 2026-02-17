/**
 * OpenAI OAuth (PKCE) flow.
 * Reimplemented from reference repo patterns.
 */

import { randomBytes, createHash } from "node:crypto";

const OPENAI_AUTH_URL = "https://auth.openai.com/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";

export interface OpenAITokenResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * Generate a PKCE code verifier and challenge (S256).
 */
export function generatePKCE(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
    return { verifier, challenge };
}

/**
 * Build the OpenAI OAuth authorization URL.
 */
export function buildOpenAIAuthUrl(
    clientId: string,
    redirectUri: string,
    state: string,
    codeChallenge: string
): string {
    const url = new URL(OPENAI_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openai.public");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    url.searchParams.set("audience", "https://api.openai.com/v1");
    return url.toString();
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeOpenAICode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier: string
): Promise<OpenAITokenResult> {
    const response = await fetch(OPENAI_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            client_id: clientId,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
    };
}
