/**
 * GET /api/auth/openai/login
 * Initiates OpenAI OAuth flow with PKCE.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildOpenAIAuthUrl, generatePKCE } from "@/lib/auth/openai-oauth";
import { encrypt } from "@/lib/crypto";

export async function GET() {
    const clientId = process.env.OPENAI_CLIENT_ID;
    const redirectUri =
        process.env.OPENAI_REDIRECT_URI ||
        "http://localhost:4000/api/auth/openai/callback";

    if (!clientId) {
        return NextResponse.json(
            { error: "OpenAI OAuth not configured" },
            { status: 500 }
        );
    }

    const pkce = generatePKCE();
    const state = randomBytes(16).toString("hex");

    const cookieData = encrypt(
        JSON.stringify({ verifier: pkce.verifier, state })
    );
    const cookieStore = await cookies();
    cookieStore.set("openai_oauth_state", cookieData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
    });

    const authUrl = buildOpenAIAuthUrl(clientId, redirectUri, state, pkce.challenge);

    return NextResponse.redirect(authUrl);
}
