import { db } from "@/db";
import { usageLogs, providers, models, apiKeys } from "@/db/schema";
import { eq, desc, sql, gte } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin-auth";

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
    fontSize: 13,
};

const cardStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "20px 24px",
};

export default async function UsagePage() {
    await requireAdmin();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [summaryResult, recentLogs] = await Promise.all([
        db
            .select({
                totalRequests: sql<number>`count(*)`,
                totalInputTokens: sql<number>`coalesce(sum(${usageLogs.inputTokens}), 0)`,
                totalOutputTokens: sql<number>`coalesce(sum(${usageLogs.outputTokens}), 0)`,
                totalCost: sql<string>`coalesce(sum(${usageLogs.cost}), 0)`,
                avgLatency: sql<number>`coalesce(avg(${usageLogs.latency}), 0)`,
            })
            .from(usageLogs)
            .where(gte(usageLogs.createdAt, oneDayAgo)),

        db
            .select({
                id: usageLogs.id,
                inputTokens: usageLogs.inputTokens,
                outputTokens: usageLogs.outputTokens,
                cost: usageLogs.cost,
                latency: usageLogs.latency,
                statusCode: usageLogs.statusCode,
                createdAt: usageLogs.createdAt,
                providerName: providers.name,
                modelName: models.publicName,
                keyPrefix: apiKeys.keyPrefix,
            })
            .from(usageLogs)
            .leftJoin(providers, eq(usageLogs.providerId, providers.id))
            .leftJoin(models, eq(usageLogs.modelId, models.id))
            .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
            .orderBy(desc(usageLogs.createdAt))
            .limit(100),
    ]);

    const summary = summaryResult[0];

    return (
        <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 24px", letterSpacing: "-0.02em" }}>
                Usage Analytics
            </h2>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 32 }}>
                <div style={cardStyle}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                        Requests (24h)
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {(summary?.totalRequests || 0).toLocaleString()}
                    </p>
                </div>
                <div style={cardStyle}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                        Input Tokens
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {(summary?.totalInputTokens || 0).toLocaleString()}
                    </p>
                </div>
                <div style={cardStyle}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                        Output Tokens
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {(summary?.totalOutputTokens || 0).toLocaleString()}
                    </p>
                </div>
                <div style={cardStyle}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                        Estimated Cost
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
                        ${parseFloat(summary?.totalCost || "0").toFixed(4)}
                    </p>
                </div>
                <div style={cardStyle}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                        Avg Latency
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {Math.round(summary?.avgLatency || 0)}ms
                    </p>
                </div>
            </div>

            {/* Recent logs table */}
            <div
                style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    overflow: "hidden",
                }}
            >
                <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                        Recent Requests (last 100)
                    </h3>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Time</th>
                            <th style={thStyle}>Provider</th>
                            <th style={thStyle}>Model</th>
                            <th style={thStyle}>API Key</th>
                            <th style={thStyle}>Tokens (in/out)</th>
                            <th style={thStyle}>Latency</th>
                            <th style={thStyle}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentLogs.map((log) => (
                            <tr key={log.id}>
                                <td style={tdStyle}>{log.createdAt.toLocaleString()}</td>
                                <td style={tdStyle}>{log.providerName || "—"}</td>
                                <td style={tdStyle}><code style={{ color: "#a5b4fc" }}>{log.modelName || "—"}</code></td>
                                <td style={tdStyle}><code style={{ color: "rgba(255,255,255,0.5)" }}>{log.keyPrefix || "—"}</code></td>
                                <td style={tdStyle}>{log.inputTokens}/{log.outputTokens}</td>
                                <td style={tdStyle}>{log.latency}ms</td>
                                <td style={tdStyle}>
                                    <span style={{
                                        padding: "2px 8px", borderRadius: 4, fontSize: 12,
                                        background: (log.statusCode || 0) < 400 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                        color: (log.statusCode || 0) < 400 ? "#4ade80" : "#f87171",
                                    }}>
                                        {log.statusCode || "—"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {recentLogs.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>
                                    No usage data yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
