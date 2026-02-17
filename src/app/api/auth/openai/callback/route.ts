/**
 * GET /api/auth/openai/callback
 * Handles OpenAI OAuth callback, exchanges code for tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeOpenAICode } from "@/lib/auth/openai-oauth";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/db";
import { oauthAccounts, providers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("openai-oauth-callback");

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
            log.error("OpenAI OAuth error", { error });
            return NextResponse.redirect(
                new URL("/admin/oauth-accounts?error=oauth_denied", req.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL("/admin/oauth-accounts?error=missing_params", req.url)
            );
        }

        const cookieStore = await cookies();
        const stateCookie = cookieStore.get("openai_oauth_state");
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

        const clientId = process.env.OPENAI_CLIENT_ID!;
        const redirectUri =
            process.env.OPENAI_REDIRECT_URI ||
            "http://localhost:4000/api/auth/openai/callback";

        const result = await exchangeOpenAICode(
            code,
            clientId,
            redirectUri,
            savedState.verifier
        );

        // Find or create OpenAI provider
        let [provider] = await db
            .select()
            .from(providers)
            .where(and(eq(providers.type, "openai"), eq(providers.isActive, true)))
            .limit(1);

        if (!provider) {
            const [created] = await db
                .insert(providers)
                .values({
                    name: "OpenAI",
                    type: "openai",
                    baseUrl: "https://api.openai.com",
                    authType: "oauth",
                })
                .returning();
            provider = created;
        }

        await db.insert(oauthAccounts).values({
            providerId: provider.id,
            encryptedAccessToken: encrypt(result.accessToken),
            encryptedRefreshToken: encrypt(result.refreshToken),
            expiresAt: new Date(Date.now() + result.expiresIn * 1000),
        });

        cookieStore.delete("openai_oauth_state");

        log.info("OpenAI OAuth account connected");

        return NextResponse.redirect(
            new URL("/admin/oauth-accounts?success=connected", req.url)
        );
    } catch (err) {
        log.error("OpenAI OAuth callback failed", {
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.redirect(
            new URL("/admin/oauth-accounts?error=exchange_failed", req.url)
        );
    }
}
