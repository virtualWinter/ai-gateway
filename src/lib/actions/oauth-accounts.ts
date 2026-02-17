"use server";

/**
 * Server actions for OAuth account management.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { oauthAccounts, providers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin-auth";

export async function listOAuthAccounts() {
    await requireAdmin();
    return db
        .select({
            id: oauthAccounts.id,
            providerId: oauthAccounts.providerId,
            email: oauthAccounts.email,
            expiresAt: oauthAccounts.expiresAt,
            healthScore: oauthAccounts.healthScore,
            lastUsedAt: oauthAccounts.lastUsedAt,
            isActive: oauthAccounts.isActive,
            createdAt: oauthAccounts.createdAt,
            providerName: providers.name,
            providerType: providers.type,
        })
        .from(oauthAccounts)
        .leftJoin(providers, eq(oauthAccounts.providerId, providers.id))
        .orderBy(oauthAccounts.createdAt);
}

export async function removeOAuthAccount(id: string) {
    await requireAdmin();
    await db.delete(oauthAccounts).where(eq(oauthAccounts.id, id));
    revalidatePath("/admin/oauth-accounts");
}

export async function toggleOAuthAccountActive(id: string) {
    await requireAdmin();

    const [account] = await db
        .select()
        .from(oauthAccounts)
        .where(eq(oauthAccounts.id, id))
        .limit(1);

    if (!account) throw new Error("Account not found");

    await db
        .update(oauthAccounts)
        .set({ isActive: !account.isActive })
        .where(eq(oauthAccounts.id, id));

    revalidatePath("/admin/oauth-accounts");
}
