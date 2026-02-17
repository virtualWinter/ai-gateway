/**
 * Model → Provider routing engine.
 * Resolves models from the database, loads provider config, handles OAuth token refresh.
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { providers, models, oauthAccounts } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { createLogger } from "@/lib/logger";
import { Errors } from "@/lib/errors";
import { validateBaseUrl } from "@/lib/proxy/ssrf";
import { selectBestAccount, refreshIfExpired } from "@/lib/rotation/account-rotation";

const log = createLogger("router");

export interface ResolvedRoute {
    provider: {
        id: string;
        name: string;
        type: string;
        baseUrl: string;
        authType: string;
        timeout: number;
        credentials?: string; // Decrypted
    };
    model: {
        id: string;
        publicName: string;
        upstreamModelName: string;
        supportsStreaming: boolean;
    };
    oauthAccount?: {
        id: string;
        accessToken: string;
    };
}

/**
 * Resolve a public model name to a provider + upstream model.
 * Supports fallback chains via model priority.
 */
export async function resolveRoute(
    modelName: string
): Promise<ResolvedRoute> {
    // Query models joined with providers, ordered by priority (highest first)
    const rows = await db
        .select({
            modelId: models.id,
            publicName: models.publicName,
            upstreamModelName: models.upstreamModelName,
            supportsStreaming: models.supportsStreaming,
            priority: models.priority,
            providerId: providers.id,
            providerName: providers.name,
            providerType: providers.type,
            baseUrl: providers.baseUrl,
            authType: providers.authType,
            encryptedCredentials: providers.encryptedCredentials,
            timeout: providers.timeout,
        })
        .from(models)
        .innerJoin(providers, eq(models.providerId, providers.id))
        .where(
            and(
                eq(models.publicName, modelName),
                eq(models.isActive, true),
                eq(providers.isActive, true)
            )
        )
        .orderBy(asc(models.priority))
        .limit(5);

    if (rows.length === 0) {
        throw Errors.modelNotFound(modelName);
    }

    // Try each provider in priority order (fallback chain)
    for (const row of rows) {
        try {
            // Validate base URL (SSRF protection)
            const urlCheck = validateBaseUrl(row.baseUrl);
            if (!urlCheck.valid) {
                log.warn("Skipping provider with blocked base_url", {
                    provider: row.providerName,
                    reason: urlCheck.reason,
                });
                continue;
            }

            // Decrypt credentials
            let credentials: string | undefined;
            if (row.encryptedCredentials) {
                try {
                    credentials = decrypt(row.encryptedCredentials);
                } catch (err) {
                    log.error("Failed to decrypt provider credentials", {
                        provider: row.providerName,
                        error: String(err),
                    });
                    continue;
                }
            }

            // For OAuth providers, select and refresh account
            let oauthAccount: ResolvedRoute["oauthAccount"];
            if (row.authType === "oauth") {
                const account = await selectBestAccount(row.providerId);
                if (!account) {
                    log.warn("No available OAuth accounts for provider", {
                        provider: row.providerName,
                    });
                    continue;
                }

                const refreshed = await refreshIfExpired(account, row.providerType);
                oauthAccount = {
                    id: refreshed.id,
                    accessToken: decrypt(refreshed.encryptedAccessToken),
                };
            }

            return {
                provider: {
                    id: row.providerId,
                    name: row.providerName,
                    type: row.providerType,
                    baseUrl: row.baseUrl,
                    authType: row.authType,
                    timeout: row.timeout,
                    credentials,
                },
                model: {
                    id: row.modelId,
                    publicName: row.publicName,
                    upstreamModelName: row.upstreamModelName,
                    supportsStreaming: row.supportsStreaming,
                },
                oauthAccount,
            };
        } catch (err) {
            log.warn("Fallback: provider failed during resolution", {
                provider: row.providerName,
                error: err instanceof Error ? err.message : String(err),
            });
            continue;
        }
    }

    throw Errors.providerError(
        `No available provider for model '${modelName}'`,
        "All providers in fallback chain failed"
    );
}
