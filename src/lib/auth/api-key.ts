/**
 * API key hashing and validation.
 * Keys are SHA-256 hashed before storage — the raw key is only shown once at creation.
 */

import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";

const API_KEY_PREFIX = "sk-gw-";

/**
 * Generate a cryptographically random API key.
 * Returns both the raw key (to show the user) and the hash (to store).
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
    const bytes = randomBytes(32);
    const raw = `${API_KEY_PREFIX}${bytes.toString("hex")}`;
    const hash = hashApiKey(raw);
    const prefix = raw.slice(0, 12) + "...";
    return { raw, hash, prefix };
}

/** SHA-256 hash an API key for storage/lookup */
export function hashApiKey(key: string): string {
    return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Extract the bearer token from an Authorization header */
export function extractBearerToken(
    authHeader: string | null
): string | undefined {
    if (!authHeader?.startsWith("Bearer ")) return undefined;
    return authHeader.slice(7).trim();
}

/** Validate an API key against the database */
export async function validateApiKey(rawKey: string) {
    const hash = hashApiKey(rawKey);
    const [row] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hash))
        .limit(1);

    if (!row || !row.isActive) return null;
    return row;
}
