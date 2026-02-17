"use server";

/**
 * Server actions for model management.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { models } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin-auth";

export async function listModels() {
    await requireAdmin();
    return db.select().from(models).orderBy(models.createdAt);
}

export async function createModel(formData: FormData) {
    await requireAdmin();

    const providerId = formData.get("providerId") as string;
    const publicName = formData.get("publicName") as string;
    const upstreamModelName = formData.get("upstreamModelName") as string;
    const supportsStreaming = formData.get("supportsStreaming") === "true";
    const priority = parseInt((formData.get("priority") as string) || "0", 10);

    if (!providerId || !publicName || !upstreamModelName) {
        throw new Error("Provider, public name, and upstream model name are required");
    }

    await db.insert(models).values({
        providerId,
        publicName,
        upstreamModelName,
        supportsStreaming,
        priority,
    });

    revalidatePath("/admin/models");
}

export async function toggleModelActive(id: string) {
    await requireAdmin();

    const [model] = await db
        .select()
        .from(models)
        .where(eq(models.id, id))
        .limit(1);

    if (!model) throw new Error("Model not found");

    await db
        .update(models)
        .set({ isActive: !model.isActive })
        .where(eq(models.id, id));

    revalidatePath("/admin/models");
}

export async function deleteModel(id: string) {
    await requireAdmin();
    await db.delete(models).where(eq(models.id, id));
    revalidatePath("/admin/models");
}
