/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback, exchanges code for tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeGoogleCode } from "@/lib/auth/google-oauth";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/db";
import { oauthAccounts, providers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { config } from "@/lib/config";

const log = createLogger("google-oauth-callback");

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
            log.error("Google OAuth error", { error });
            return NextResponse.redirect(
                new URL("/admin/oauth-accounts?error=oauth_denied", req.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL("/admin/oauth-accounts?error=missing_params", req.url)
            );
        }

        // Retrieve and validate state from cookie
        const cookieStore = await cookies();
        const stateCookie = cookieStore.get("google_oauth_state");
        if (!stateCookie) {
            return NextResponse.redirect(
                new URL("/admin/oauth-accounts?error=state_expired", req.url)
            );
        }

        const savedState = JSON.parse(decrypt(stateCookie.value)) as {
            verifier: string;
            state: string;
        };

        if (savedState.state !== state) {
            return NextResponse.redirect(
                new URL("/admin/oauth-accounts?error=state_mismatch", req.url)
            );
        }

        // Exchange code for tokens
        const clientId = config.googleClientId!;
        const clientSecret = config.googleClientSecret!;
        const redirectUri =
            config.googleRedirectUri ||
            `${config.baseUrl}/api/auth/google/callback`;

        const result = await exchangeGoogleCode(
            code,
            clientId,
            clientSecret,
            redirectUri,
            savedState.verifier
        );

        // Find or create Google provider
        let [provider] = await db
            .select()
            .from(providers)
            .where(and(eq(providers.type, "google"), eq(providers.isActive, true)))
            .limit(1);

        if (!provider) {
            // Auto-create a Google provider
            const [created] = await db
                .insert(providers)
                .values({
                    name: "Google AI",
                    type: "google",
                    baseUrl: "https://generativelanguage.googleapis.com",
                    authType: "oauth",
                })
                .returning();
            provider = created;
        }

        // Store OAuth account
        await db.insert(oauthAccounts).values({
            providerId: provider.id,
            encryptedAccessToken: encrypt(result.accessToken),
            encryptedRefreshToken: encrypt(result.refreshToken),
            expiresAt: new Date(Date.now() + result.expiresIn * 1000),
            email: result.email || null,
        });

        // Clear state cookie
        cookieStore.delete("google_oauth_state");

        log.info("Google OAuth account connected", { email: result.email });

        return NextResponse.redirect(
            new URL("/admin/oauth-accounts?success=connected", req.url)
        );
    } catch (err) {
        log.error("Google OAuth callback failed", {
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.redirect(
            new URL("/admin/oauth-accounts?error=exchange_failed", req.url)
        );
    }
}
