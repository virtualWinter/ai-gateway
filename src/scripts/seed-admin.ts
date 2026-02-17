/**
 * Seed script: creates an initial admin user.
 *
 * Usage: bun run src/scripts/seed-admin.ts
 */

import { db } from "../db";
import { adminUsers } from "../db/schema";
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

    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
