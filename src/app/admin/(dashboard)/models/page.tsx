import { listModels, createModel, toggleModelActive, deleteModel } from "@/lib/actions/models";
import { listProviders } from "@/lib/actions/providers";

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

export default async function ModelsPage() {
    const [modelsList, providersList] = await Promise.all([
        listModels(),
        listProviders(),
    ]);

    const providerMap = new Map(providersList.map((p) => [p.id, p.name]));

    return (
        <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 24px", letterSpacing: "-0.02em" }}>
                Models
            </h2>

            {/* Add model form */}
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
                    Add Model
                </h3>
                <form action={createModel}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Provider</label>
                            <select name="providerId" required style={{ ...inputStyle, appearance: "none" as const }}>
                                <option value="">Select...</option>
                                {providersList.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Public Name</label>
                            <input name="publicName" placeholder="gpt-4o" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Upstream Name</label>
                            <input name="upstreamModelName" placeholder="gpt-4o-2024-08-06" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Priority</label>
                            <input name="priority" placeholder="0" defaultValue="0" style={inputStyle} />
                        </div>
                        <div>
                            <input type="hidden" name="supportsStreaming" value="true" />
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
                                Add
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Models table */}
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
                            <th style={thStyle}>Public Name</th>
                            <th style={thStyle}>Upstream Name</th>
                            <th style={thStyle}>Provider</th>
                            <th style={thStyle}>Streaming</th>
                            <th style={thStyle}>Priority</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {modelsList.map((m) => (
                            <tr key={m.id}>
                                <td style={tdStyle}><code style={{ color: "#a5b4fc" }}>{m.publicName}</code></td>
                                <td style={tdStyle}><code style={{ color: "rgba(255,255,255,0.5)" }}>{m.upstreamModelName}</code></td>
                                <td style={tdStyle}>{providerMap.get(m.providerId) || "—"}</td>
                                <td style={tdStyle}>{m.supportsStreaming ? "✓" : "✗"}</td>
                                <td style={tdStyle}>{m.priority}</td>
                                <td style={tdStyle}>
                                    <span style={{
                                        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                        background: m.isActive ? "#22c55e" : "#ef4444", marginRight: 6,
                                    }} />
                                    {m.isActive ? "Active" : "Inactive"}
                                </td>
                                <td style={tdStyle}>
                                    <form style={{ display: "inline" }} action={toggleModelActive.bind(null, m.id)}>
                                        <button type="submit" style={btnStyle}>{m.isActive ? "Disable" : "Enable"}</button>
                                    </form>
                                    <form style={{ display: "inline" }} action={deleteModel.bind(null, m.id)}>
                                        <button type="submit" style={{ ...btnStyle, color: "#f87171", borderColor: "rgba(239,68,68,0.2)" }}>Delete</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {modelsList.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>
                                    No models configured yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
