import { listProviders, createProvider, toggleProviderActive, deleteProvider } from "@/lib/actions/providers";

const tableStyle = {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
};

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

export default async function ProvidersPage() {
    const providersList = await listProviders();

    return (
        <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 24px", letterSpacing: "-0.02em" }}>
                Providers
            </h2>

            {/* Add provider form */}
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
                    Add Provider
                </h3>
                <form action={createProvider}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <input name="name" placeholder="Name (e.g. OpenAI)" required style={inputStyle} />
                        <select name="type" required style={{ ...inputStyle, appearance: "none" as const }}>
                            <option value="">Type...</option>
                            <option value="openai">OpenAI</option>
                            <option value="google">Google</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="oauth">OAuth</option>
                            <option value="custom">Custom</option>
                        </select>
                        <select name="authType" required style={{ ...inputStyle, appearance: "none" as const }}>
                            <option value="bearer">Bearer Token</option>
                            <option value="header">Custom Header</option>
                            <option value="oauth">OAuth</option>
                            <option value="none">None</option>
                        </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                        <input name="baseUrl" placeholder="Base URL (e.g. https://api.openai.com)" required style={inputStyle} />
                        <input name="credentials" placeholder="Credentials (API key)" type="password" style={inputStyle} />
                        <input name="timeout" placeholder="Timeout (ms)" defaultValue="30000" style={inputStyle} />
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
                        }}
                    >
                        Add Provider
                    </button>
                </form>
            </div>

            {/* Providers table */}
            <div
                style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    overflow: "hidden",
                }}
            >
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Auth</th>
                            <th style={thStyle}>Base URL</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {providersList.map((p) => (
                            <tr key={p.id}>
                                <td style={tdStyle}>{p.name}</td>
                                <td style={tdStyle}>
                                    <span
                                        style={{
                                            padding: "2px 8px",
                                            borderRadius: 4,
                                            background: "rgba(99,102,241,0.1)",
                                            color: "#818cf8",
                                            fontSize: 12,
                                        }}
                                    >
                                        {p.type}
                                    </span>
                                </td>
                                <td style={tdStyle}>{p.authType}</td>
                                <td style={{ ...tdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {p.baseUrl}
                                </td>
                                <td style={tdStyle}>
                                    <span
                                        style={{
                                            display: "inline-block",
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: p.isActive ? "#22c55e" : "#ef4444",
                                            marginRight: 6,
                                        }}
                                    />
                                    {p.isActive ? "Active" : "Inactive"}
                                </td>
                                <td style={tdStyle}>
                                    <form style={{ display: "inline" }} action={toggleProviderActive.bind(null, p.id)}>
                                        <button type="submit" style={btnStyle}>
                                            {p.isActive ? "Disable" : "Enable"}
                                        </button>
                                    </form>
                                    <form style={{ display: "inline" }} action={deleteProvider.bind(null, p.id)}>
                                        <button type="submit" style={{ ...btnStyle, color: "#f87171", borderColor: "rgba(239,68,68,0.2)" }}>
                                            Delete
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {providersList.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>
                                    No providers configured yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
