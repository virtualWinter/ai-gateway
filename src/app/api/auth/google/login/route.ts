/**
 * GET /api/auth/google/login
 * Initiates Google OAuth flow with PKCE.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildGoogleAuthUrl, generatePKCE } from "@/lib/auth/google-oauth";
import { encrypt } from "@/lib/crypto";

export async function GET() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri =
        process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:3000/api/auth/google/callback";
    const scopes =
        process.env.GOOGLE_SCOPES ||
        "openid email https://www.googleapis.com/auth/cloud-platform";

    if (!clientId) {
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
}
