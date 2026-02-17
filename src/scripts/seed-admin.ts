/**
 * Seed script: creates an initial admin user.
 *
 * Usage: bun run src/scripts/seed-admin.ts
 */

import { db } from "../db";
import { adminUsers, providers, models } from "../db/schema";
import { hashPassword } from "../lib/auth/admin-auth";
import { eq } from "drizzle-orm";

async function main() {
    const email = process.env.ADMIN_EMAIL || "admin@localhost";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const name = process.env.ADMIN_NAME || "Admin";

    console.log(`Creating admin user: ${email}`);

    // Check if user already exists
    const [existing] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email))
        .limit(1);

    if (existing) {
        console.log("Admin user already exists, updating password...");
        const passwordHash = await hashPassword(password);
        await db
            .update(adminUsers)
            .set({ passwordHash, name })
            .where(eq(adminUsers.id, existing.id));
        console.log("Done.");
    } else {
        const passwordHash = await hashPassword(password);
        await db.insert(adminUsers).values({
            email,
            passwordHash,
            name,
            role: "admin",
        });
        console.log("Admin user created.");
    }

    // Ensure default providers exist
    const defaultProviders = [
        {
            name: "Google AI",
            type: "google" as const,
            baseUrl: "https://generativelanguage.googleapis.com",
            authType: "oauth" as const,
        },
        {
            name: "OpenAI",
            type: "openai" as const,
            baseUrl: "https://api.openai.com",
            authType: "oauth" as const,
        },
    ];

    for (const p of defaultProviders) {
        const [existing] = await db
            .select()
            .from(providers)
            .where(eq(providers.type, p.type))
            .limit(1);

        if (!existing) {
            console.log(`Preconfiguring provider: ${p.name}`);
            const [created] = await db.insert(providers).values(p).returning();

            // Seed models for this provider
            const providerModels = p.type === "google" ? [
                // Gemini 3
                { publicName: "gemini-3-pro-low", upstreamModelName: "gemini-3-pro" },
                { publicName: "gemini-3-pro-high", upstreamModelName: "gemini-3-pro" },
                { publicName: "gemini-3-flash-low", upstreamModelName: "gemini-3-flash" },
                { publicName: "gemini-3-flash-medium", upstreamModelName: "gemini-3-flash" },
                { publicName: "gemini-3-flash-high", upstreamModelName: "gemini-3-flash" },
                // Gemini 2.5
                { publicName: "gemini-2.5-pro", upstreamModelName: "gemini-2.5-pro" },
                { publicName: "gemini-2.5-flash", upstreamModelName: "gemini-2.5-flash" },
                // Claude Variants (Antigravity routes these through Google/Gemini)
                { publicName: "gemini-claude-sonnet-4-5", upstreamModelName: "claude-sonnet-4-5" },
                { publicName: "gemini-claude-sonnet-4-5-thinking-low", upstreamModelName: "claude-sonnet-4-5-thinking" },
                { publicName: "gemini-claude-sonnet-4-5-thinking-medium", upstreamModelName: "claude-sonnet-4-5-thinking" },
                { publicName: "gemini-claude-sonnet-4-5-thinking-high", upstreamModelName: "claude-sonnet-4-5-thinking" },
                { publicName: "gemini-claude-opus-4-5-thinking-low", upstreamModelName: "claude-opus-4-5-thinking" },
                { publicName: "gemini-claude-opus-4-5-thinking-medium", upstreamModelName: "claude-opus-4-5-thinking" },
                { publicName: "gemini-claude-opus-4-5-thinking-high", upstreamModelName: "claude-opus-4-5-thinking" },
            ] : [
                { publicName: "gpt-4o", upstreamModelName: "gpt-4o" },
                { publicName: "gpt-4o-mini", upstreamModelName: "gpt-4o-mini" },
                { publicName: "o1-preview", upstreamModelName: "o1-preview" },
                { publicName: "o1-mini", upstreamModelName: "o1-mini" },
            ];

            for (const m of providerModels) {
                await db.insert(models).values({
                    ...m,
                    providerId: created.id,
                    isActive: true,
                });
            }
        } else {
            console.log(`Provider already exists: ${p.name}`);
        }
    }

    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
