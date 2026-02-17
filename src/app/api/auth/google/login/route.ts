/**
 * GET /api/auth/google/login
 * Initiates Google OAuth flow with PKCE.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildGoogleAuthUrl, generatePKCE } from "@/lib/auth/google-oauth";
import { encrypt } from "@/lib/crypto";

import { config } from "@/lib/config";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-login");

export async function GET() {
    try {
        const clientId = config.googleClientId;
        const redirectUri =
            config.googleRedirectUri ||
            `${config.baseUrl}/api/auth/google/callback`;
        const scopes = config.googleScopes;

        if (!clientId) {
            log.warn("Google OAuth client ID is missing");
            return NextResponse.json(
                { error: "Google OAuth not configured" },
                { status: 500 }
            );
        }

        const pkce = generatePKCE();
        const state = randomBytes(16).toString("hex");

        // Store verifier and state in encrypted cookie
        const cookieData = encrypt(
            JSON.stringify({ verifier: pkce.verifier, state })
        );
        const cookieStore = await cookies();
        cookieStore.set("google_oauth_state", cookieData, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600, // 10 minutes
        });

        const authUrl = buildGoogleAuthUrl(
            clientId,
            redirectUri,
            scopes,
            state,
            pkce.challenge
        );

        return NextResponse.redirect(authUrl);
    } catch (err) {
        log.error("Google login initiation failed", {
            error: err instanceof Error ? err.message : String(err),
        });

        const message = err instanceof Error ? err.message : "Internal Server Error";

        // Return a more helpful error page for common configuration issues
        if (message.includes("ENCRYPTION_KEY")) {
            return new NextResponse(
                `<html><body><h1>Configuration Error</h1><p>${message}</p><p>Please ensure ENCRYPTION_KEY is a 64-character hex string in your environment variables.</p></body></html>`,
                { status: 500, headers: { "Content-Type": "text/html" } }
            );
        }

        return NextResponse.json(
            { error: "Failed to initiate Google login" },
            { status: 500 }
        );
    }
}
