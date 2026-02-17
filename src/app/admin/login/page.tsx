import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    verifyPassword,
    createSession,
    setSessionCookie,
    destroySession,
    clearSessionCookie,
} from "@/lib/auth/admin-auth";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

async function loginAction(formData: FormData) {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        redirect("/admin/login?error=missing_fields");
    }

    const [user] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email))
        .limit(1);

    if (!user || !user.isActive) {
        redirect("/admin/login?error=invalid_credentials");
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
        redirect("/admin/login?error=invalid_credentials");
    }

    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    redirect("/admin");
}

async function logoutAction() {
    "use server";

    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;
    if (token) {
        await destroySession(token);
    }
    await clearSessionCookie();
    redirect("/admin/login");
}

export default async function AdminLoginPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string; action?: string }>;
}) {
    const params = await searchParams;

    if (params.action === "logout") {
        await logoutAction();
    }

    const error = params.error;

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "linear-gradient(135deg, #0a0a0f 0%, #111128 50%, #0a0a0f 100%)",
            }}
        >
            <div
                style={{
                    width: 400,
                    padding: 40,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    backdropFilter: "blur(20px)",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <h1
                        style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: "#fff",
                            margin: "0 0 8px",
                            letterSpacing: "-0.03em",
                        }}
                    >
                        ⚡ AI Gateway
                    </h1>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                        Sign in to admin dashboard
                    </p>
                </div>

                {error && (
                    <div
                        style={{
                            padding: "10px 14px",
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: 8,
                            color: "#f87171",
                            fontSize: 13,
                            marginBottom: 20,
                        }}
                    >
                        {error === "invalid_credentials"
                            ? "Invalid email or password"
                            : error === "missing_fields"
                                ? "Email and password are required"
                                : "An error occurred"}
                    </div>
                )}

                <form action={loginAction}>
                    <div style={{ marginBottom: 16 }}>
                        <label
                            style={{
                                display: "block",
                                fontSize: 13,
                                color: "rgba(255,255,255,0.6)",
                                marginBottom: 6,
                            }}
                        >
                            Email
                        </label>
                        <input
                            name="email"
                            type="email"
                            required
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                color: "#fff",
                                fontSize: 14,
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label
                            style={{
                                display: "block",
                                fontSize: 13,
                                color: "rgba(255,255,255,0.6)",
                                marginBottom: 6,
                            }}
                        >
                            Password
                        </label>
                        <input
                            name="password"
                            type="password"
                            required
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                color: "#fff",
                                fontSize: 14,
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        style={{
                            width: "100%",
                            padding: "12px 0",
                            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "opacity 0.15s",
                        }}
                    >
                        Sign in
                    </button>
                </form>
            </div>
        </div>
    );
}
