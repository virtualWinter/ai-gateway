/**
 * Google OAuth (PKCE) flow.
 * Reimplemented from reference repo patterns.
 */

import { randomBytes, createHash } from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL =
    "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";

export interface GoogleTokenResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    email?: string;
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
 * Build the Google OAuth authorization URL.
 */
export function buildGoogleAuthUrl(
    clientId: string,
    redirectUri: string,
    scopes: string,
    state: string,
    codeChallenge: string
): string {
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    return url.toString();
}

/**
 * Resolve the Google Cloud project ID associated with the account.
 */
async function fetchProjectID(accessToken: string): Promise<string> {
    const endpoints = [
        "https://cloudcode-pa.googleapis.com",
        "https://daily-cloudcode-pa.sandbox.googleapis.com",
        "https://autopush-cloudcode-pa.sandbox.googleapis.com",
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    "User-Agent": "google-api-nodejs-client/9.15.1",
                    "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
                },
                body: JSON.stringify({
                    metadata: {
                        ideType: "ANTIGRAVITY",
                        platform: process.platform === "win32" ? "WINDOWS" : "MACOS",
                        pluginType: "GEMINI",
                    },
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const projectId =
                    data.cloudaicompanionProject?.id ||
                    data.cloudaicompanionProject;
                if (projectId && typeof projectId === "string") {
                    return projectId;
                }
            }
        } catch {
            // Try next endpoint
        }
    }
    return "";
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeGoogleCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    codeVerifier: string
): Promise<GoogleTokenResult> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };

    // Fetch user email
    let email: string | undefined;
    try {
        const userResponse = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (userResponse.ok) {
            const userInfo = (await userResponse.json()) as { email?: string };
            email = userInfo.email;
        }
    } catch {
        // Non-critical
    }

    // Resolve project ID
    const projectId = await fetchProjectID(data.access_token);

    return {
        accessToken: data.access_token,
        // Store refresh token with project ID suffix
        refreshToken: `${data.refresh_token}|${projectId}`,
        expiresIn: data.expires_in,
        email,
    };
}
