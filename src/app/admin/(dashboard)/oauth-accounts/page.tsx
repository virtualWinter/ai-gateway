import { listOAuthAccounts, removeOAuthAccount, toggleOAuthAccountActive } from "@/lib/actions/oauth-accounts";
import Link from "next/link";

const thStyle = {
    textAlign: "left" as const,
    padding: "10px 14px",
    color: "rgba(255,255,255,0.4)",
    fontWeight: 500 as const,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const tdStyle = {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.8)",
};

const btnStyle = {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    cursor: "pointer",
    marginRight: 6,
};

export default async function OAuthAccountsPage({
    searchParams,
}: {
    searchParams: Promise<{ success?: string; error?: string }>;
}) {
    const params = await searchParams;
    const accounts = await listOAuthAccounts();

    return (
        <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 24px", letterSpacing: "-0.02em" }}>
                OAuth Accounts
            </h2>

            {/* Status messages */}
            {params.success === "connected" && (
                <div style={{
                    padding: "12px 16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 8, color: "#4ade80", fontSize: 13, marginBottom: 16,
                }}>
                    ✓ Account connected successfully
                </div>
            )}
            {params.error && (
                <div style={{
                    padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 8, color: "#f87171", fontSize: 13, marginBottom: 16,
                }}>
                    Error: {params.error.replace(/_/g, " ")}
                </div>
            )}

            {/* Connect buttons */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                <Link
                    href="/api/auth/google/login"
                    style={{
                        padding: "10px 20px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    🔗 Connect Google Account
                </Link>
                <Link
                    href="/api/auth/openai/login"
                    style={{
                        padding: "10px 20px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    🔗 Connect OpenAI Account
                </Link>
            </div>

            {/* Accounts table */}
            <div
                style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    overflow: "hidden",
                }}
            >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Provider</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Token Expires</th>
                            <th style={thStyle}>Health</th>
                            <th style={thStyle}>Last Used</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((a) => {
                            const expired = a.expiresAt < new Date();
                            const healthColor = a.healthScore >= 60 ? "#22c55e" : a.healthScore >= 30 ? "#fbbf24" : "#ef4444";

                            return (
                                <tr key={a.id}>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: "2px 8px", borderRadius: 4,
                                            background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 12,
                                        }}>
                                            {a.providerName || a.providerType || "—"}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>{a.email || "—"}</td>
                                    <td style={tdStyle}>
                                        <span style={{ color: expired ? "#f87171" : "rgba(255,255,255,0.6)" }}>
                                            {expired ? "Expired" : a.expiresAt.toLocaleString()}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ color: healthColor, fontWeight: 600 }}>{a.healthScore}</span>
                                        <span style={{ color: "rgba(255,255,255,0.3)" }}>/100</span>
                                    </td>
                                    <td style={tdStyle}>
                                        {a.lastUsedAt ? a.lastUsedAt.toLocaleString() : "Never"}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                            background: a.isActive ? "#22c55e" : "#ef4444", marginRight: 6,
                                        }} />
                                        {a.isActive ? "Active" : "Inactive"}
                                    </td>
                                    <td style={tdStyle}>
                                        <form style={{ display: "inline" }} action={toggleOAuthAccountActive.bind(null, a.id)}>
                                            <button type="submit" style={btnStyle}>
                                                {a.isActive ? "Disable" : "Enable"}
                                            </button>
                                        </form>
                                        <form style={{ display: "inline" }} action={removeOAuthAccount.bind(null, a.id)}>
                                            <button type="submit" style={{ ...btnStyle, color: "#f87171", borderColor: "rgba(239,68,68,0.2)" }}>
                                                Remove
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            );
                        })}
                        {accounts.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>
                                    No OAuth accounts connected
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
