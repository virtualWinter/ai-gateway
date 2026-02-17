"use server";

/**
 * Server actions for provider management.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { requireAdmin } from "@/lib/auth/admin-auth";

export async function listProviders() {
    await requireAdmin();
    return db.select().from(providers).orderBy(providers.createdAt);
}

export async function createProvider(formData: FormData) {
    await requireAdmin();

    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const baseUrl = formData.get("baseUrl") as string;
    const authType = formData.get("authType") as string;
    const credentials = formData.get("credentials") as string;
    const timeout = parseInt((formData.get("timeout") as string) || "30000", 10);

    if (!name || !type || !baseUrl) {
        throw new Error("Name, type, and base URL are required");
    }

    await db.insert(providers).values({
        name,
        type: type as "openai" | "google" | "anthropic" | "oauth" | "custom",
        baseUrl,
        authType: authType as "bearer" | "header" | "oauth" | "none",
        encryptedCredentials: credentials ? encrypt(credentials) : null,
        timeout,
    });

    revalidatePath("/admin/providers");
}

export async function toggleProviderActive(id: string) {
    await requireAdmin();

    const [provider] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, id))
        .limit(1);

    if (!provider) throw new Error("Provider not found");

    await db
        .update(providers)
        .set({ isActive: !provider.isActive })
        .where(eq(providers.id, id));

    revalidatePath("/admin/providers");
}

export async function deleteProvider(id: string) {
    await requireAdmin();
    await db.delete(providers).where(eq(providers.id, id));
    revalidatePath("/admin/providers");
}
