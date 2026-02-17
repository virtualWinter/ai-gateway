import { getAdminUser } from "@/lib/auth/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/providers", label: "Providers", icon: "🔌" },
    { href: "/admin/models", label: "Models", icon: "🤖" },
    { href: "/admin/api-keys", label: "API Keys", icon: "🔑" },
    { href: "/admin/oauth-accounts", label: "OAuth Accounts", icon: "🔐" },
    { href: "/admin/usage", label: "Usage", icon: "📈" },
];

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getAdminUser();

    if (!user) {
        redirect("/admin/login");
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
            {/* Sidebar */}
            <aside
                style={{
                    width: 260,
                    background: "linear-gradient(180deg, #111118 0%, #0d0d14 100%)",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    padding: "24px 0",
                }}
            >
                <div style={{ padding: "0 24px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <h1
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: "#fff",
                            margin: 0,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        ⚡ AI Gateway
                    </h1>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                        Admin Dashboard
                    </p>
                </div>

                <nav style={{ flex: 1, padding: "16px 12px" }}>
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 8,
                                color: "rgba(255,255,255,0.7)",
                                textDecoration: "none",
                                fontSize: 14,
                                transition: "all 0.15s",
                                marginBottom: 2,
                            }}
                        >
                            <span style={{ fontSize: 16 }}>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div
                    style={{
                        padding: "16px 24px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>
                        {user.email}
                    </p>
                    <form action="/admin/login?action=logout" method="GET">
                        <button
                            type="submit"
                            style={{
                                background: "none",
                                border: "none",
                                color: "rgba(255,255,255,0.3)",
                                cursor: "pointer",
                                fontSize: 12,
                                padding: "4px 0",
                                marginTop: 4,
                            }}
                        >
                            Sign out →
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main content */}
            <main
                style={{
                    flex: 1,
                    padding: 32,
                    overflowY: "auto",
                    color: "#fff",
                }}
            >
                {children}
            </main>
        </div>
    );
}
