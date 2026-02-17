"use server";

/**
 * Server actions for API key management.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/auth/api-key";
import { requireAdmin } from "@/lib/auth/admin-auth";

export async function listApiKeys() {
    await requireAdmin();
    const keys = await db
        .select({
            id: apiKeys.id,
            label: apiKeys.label,
            keyPrefix: apiKeys.keyPrefix,
            rateLimit: apiKeys.rateLimit,
            quotaLimit: apiKeys.quotaLimit,
            isActive: apiKeys.isActive,
            createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .orderBy(apiKeys.createdAt);
    return keys;
}

export async function createApiKey(formData: FormData) {
    await requireAdmin();

    const label = (formData.get("label") as string) || "";
    const rateLimit = parseInt((formData.get("rateLimit") as string) || "60", 10);
    const quotaLimitStr = formData.get("quotaLimit") as string;
    const quotaLimit = quotaLimitStr ? parseInt(quotaLimitStr, 10) : null;

    const { raw, hash, prefix } = generateApiKey();

    await db.insert(apiKeys).values({
        label,
        keyHash: hash,
        keyPrefix: prefix,
        rateLimit,
        quotaLimit,
    });

    revalidatePath("/admin/api-keys");

    // Return the raw key — can only be shown once
    return { key: raw };
}

export async function revokeApiKey(id: string) {
    await requireAdmin();
    await db
        .update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.id, id));
    revalidatePath("/admin/api-keys");
}

export async function deleteApiKey(id: string) {
    await requireAdmin();
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    revalidatePath("/admin/api-keys");
}
