/**
 * Session-based admin authentication.
 *
 * - Passwords hashed with argon2id
 * - Sessions stored in admin_sessions table
 * - Session tokens are crypto-random, stored as SHA-256 hash
 * - HTTP-only secure cookies
 */

import { randomBytes, createHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adminUsers, adminSessions } from "@/db/schema";

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_HOURS = parseInt(
    process.env.ADMIN_SESSION_TTL_HOURS || "168",
    10
);

// ── Password Hashing ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
    return hash(password, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });
}

export async function verifyPassword(
    hashedPassword: string,
    password: string
): Promise<boolean> {
    try {
        return await verify(hashedPassword, password);
    } catch {
        return false;
    }
}

// ── Session Management ─────────────────────────────────────────────────────

function hashToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Create a new session for an admin user.
 * Returns the raw token to set as cookie.
 */
export async function createSession(
    userId: string
): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    await db.insert(adminSessions).values({
        userId,
        tokenHash,
        expiresAt,
    });

    return { token, expiresAt };
}

/**
 * Validate a session token. Returns the admin user if valid, null otherwise.
 */
export async function validateSession(token: string) {
    const tokenHash = hashToken(token);

    const [session] = await db
        .select({
            sessionId: adminSessions.id,
            userId: adminSessions.userId,
            expiresAt: adminSessions.expiresAt,
            email: adminUsers.email,
            name: adminUsers.name,
            role: adminUsers.role,
            isActive: adminUsers.isActive,
        })
        .from(adminSessions)
        .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
        .where(
            and(
                eq(adminSessions.tokenHash, tokenHash),
                gt(adminSessions.expiresAt, new Date())
            )
        )
        .limit(1);

    if (!session || !session.isActive) return null;

    return {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
    };
}

/**
 * Destroy a session (logout).
 */
export async function destroySession(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await db
        .delete(adminSessions)
        .where(eq(adminSessions.tokenHash, tokenHash));
}

/**
 * Set the session cookie.
 */
export async function setSessionCookie(
    token: string,
    expiresAt: Date
): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
    });
}

/**
 * Clear the session cookie.
 */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get the current admin user from the session cookie.
 * Returns null if not authenticated.
 */
export async function getAdminUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return validateSession(token);
}

/**
 * Require an authenticated admin user.
 * Redirects to /admin/login if not authenticated.
 */
export async function requireAdmin() {
    const user = await getAdminUser();
    if (!user) {
        redirect("/admin/login");
    }
    return user;
}
