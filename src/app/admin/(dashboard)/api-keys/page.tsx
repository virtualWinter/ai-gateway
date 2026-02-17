import { listApiKeys, createApiKey, revokeApiKey, deleteApiKey } from "@/lib/actions/api-keys";

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

const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box" as const,
};

export default async function ApiKeysPage({
    searchParams,
}: {
    searchParams: Promise<{ newKey?: string }>;
}) {
    const params = await searchParams;
    const keysList = await listApiKeys();

    async function handleCreate(formData: FormData) {
        "use server";
        const result = await createApiKey(formData);
        const { redirect } = await import("next/navigation");
        redirect(`/admin/api-keys?newKey=${encodeURIComponent(result.key)}`);
    }

    return (
        <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 24px", letterSpacing: "-0.02em" }}>
                API Keys
            </h2>

            {/* Newly generated key banner */}
            {params.newKey && (
                <div
                    style={{
                        padding: "16px 20px",
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 10,
                        marginBottom: 20,
                    }}
                >
                    <p style={{ fontSize: 13, color: "#4ade80", margin: "0 0 8px", fontWeight: 600 }}>
                        🔑 New API Key Generated — Copy it now, it won&apos;t be shown again!
                    </p>
                    <code
                        style={{
                            display: "block",
                            padding: "10px 14px",
                            background: "rgba(0,0,0,0.3)",
                            borderRadius: 6,
                            color: "#fff",
                            fontSize: 13,
                            wordBreak: "break-all",
                            fontFamily: "monospace",
                        }}
                    >
                        {params.newKey}
                    </code>
                </div>
            )}

            {/* Generate key form */}
            <div
                style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 24,
                    marginBottom: 24,
                }}
            >
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 16px" }}>
                    Generate New Key
                </h3>
                <form action={handleCreate}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Label</label>
                            <input name="label" placeholder="My key" style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Rate Limit/min</label>
                            <input name="rateLimit" defaultValue="60" style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Quota (optional)</label>
                            <input name="quotaLimit" placeholder="Unlimited" style={inputStyle} />
                        </div>
                        <button
                            type="submit"
                            style={{
                                padding: "8px 20px",
                                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                border: "none",
                                borderRadius: 6,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Generate
                        </button>
                    </div>
                </form>
            </div>

            {/* Keys table */}
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
                            <th style={thStyle}>Key</th>
                            <th style={thStyle}>Label</th>
                            <th style={thStyle}>Rate Limit</th>
                            <th style={thStyle}>Quota</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Created</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keysList.map((k) => (
                            <tr key={k.id}>
                                <td style={tdStyle}>
                                    <code style={{ color: "#a5b4fc" }}>{k.keyPrefix}</code>
                                </td>
                                <td style={tdStyle}>{k.label || "—"}</td>
                                <td style={tdStyle}>{k.rateLimit}/min</td>
                                <td style={tdStyle}>{k.quotaLimit ?? "∞"}</td>
                                <td style={tdStyle}>
                                    <span style={{
                                        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                        background: k.isActive ? "#22c55e" : "#ef4444", marginRight: 6,
                                    }} />
                                    {k.isActive ? "Active" : "Revoked"}
                                </td>
                                <td style={tdStyle}>
                                    {k.createdAt.toLocaleDateString()}
                                </td>
                                <td style={tdStyle}>
                                    {k.isActive && (
                                        <form style={{ display: "inline" }} action={revokeApiKey.bind(null, k.id)}>
                                            <button type="submit" style={{ ...btnStyle, color: "#fbbf24", borderColor: "rgba(251,191,36,0.2)" }}>
                                                Revoke
                                            </button>
                                        </form>
                                    )}
                                    <form style={{ display: "inline" }} action={deleteApiKey.bind(null, k.id)}>
                                        <button type="submit" style={{ ...btnStyle, color: "#f87171", borderColor: "rgba(239,68,68,0.2)" }}>
                                            Delete
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {keysList.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>
                                    No API keys generated yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
