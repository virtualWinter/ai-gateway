import { db } from "@/db";
import { providers, models, apiKeys, oauthAccounts, usageLogs } from "@/db/schema";
import { eq, sql, gte } from "drizzle-orm";

const cardStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "20px 24px",
};

const labelStyle = {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 8px",
};

const valueStyle = {
    fontSize: 28,
    fontWeight: 700 as const,
    color: "#fff",
    margin: 0,
    letterSpacing: "-0.02em",
};

export default async function AdminDashboardPage() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
        providerCount,
        modelCount,
        apiKeyCount,
        oauthCount,
        recentUsage,
    ] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)` })
            .from(providers)
            .where(eq(providers.isActive, true)),
        db
            .select({ count: sql<number>`count(*)` })
            .from(models)
            .where(eq(models.isActive, true)),
        db
            .select({ count: sql<number>`count(*)` })
            .from(apiKeys)
            .where(eq(apiKeys.isActive, true)),
        db
            .select({ count: sql<number>`count(*)` })
            .from(oauthAccounts)
            .where(eq(oauthAccounts.isActive, true)),
        db
            .select({
                requests: sql<number>`count(*)`,
                totalInputTokens: sql<number>`coalesce(sum(${usageLogs.inputTokens}), 0)`,
                totalOutputTokens: sql<number>`coalesce(sum(${usageLogs.outputTokens}), 0)`,
                avgLatency: sql<number>`coalesce(avg(${usageLogs.latency}), 0)`,
            })
            .from(usageLogs)
            .where(gte(usageLogs.createdAt, oneDayAgo)),
    ]);

    const stats = {
        providers: providerCount[0]?.count || 0,
        models: modelCount[0]?.count || 0,
        apiKeys: apiKeyCount[0]?.count || 0,
        oauthAccounts: oauthCount[0]?.count || 0,
        requests24h: recentUsage[0]?.requests || 0,
        tokens24h:
            (recentUsage[0]?.totalInputTokens || 0) +
            (recentUsage[0]?.totalOutputTokens || 0),
        avgLatency: Math.round(recentUsage[0]?.avgLatency || 0),
    };

    return (
        <div>
            <h2
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#fff",
                    margin: "0 0 24px",
                    letterSpacing: "-0.02em",
                }}
            >
                Dashboard
            </h2>

            {/* Resource cards */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 16,
                    marginBottom: 32,
                }}
            >
                <div style={cardStyle}>
                    <p style={labelStyle}>Providers</p>
                    <p style={valueStyle}>{stats.providers}</p>
                </div>
                <div style={cardStyle}>
                    <p style={labelStyle}>Models</p>
                    <p style={valueStyle}>{stats.models}</p>
                </div>
                <div style={cardStyle}>
                    <p style={labelStyle}>API Keys</p>
                    <p style={valueStyle}>{stats.apiKeys}</p>
                </div>
                <div style={cardStyle}>
                    <p style={labelStyle}>OAuth Accounts</p>
                    <p style={valueStyle}>{stats.oauthAccounts}</p>
                </div>
            </div>

            {/* Usage cards */}
            <h3
                style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    margin: "0 0 16px",
                }}
            >
                Last 24 Hours
            </h3>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                }}
            >
                <div style={cardStyle}>
                    <p style={labelStyle}>Requests</p>
                    <p style={valueStyle}>{stats.requests24h.toLocaleString()}</p>
                </div>
                <div style={cardStyle}>
                    <p style={labelStyle}>Total Tokens</p>
                    <p style={valueStyle}>{stats.tokens24h.toLocaleString()}</p>
                </div>
                <div style={cardStyle}>
                    <p style={labelStyle}>Avg Latency</p>
                    <p style={valueStyle}>{stats.avgLatency}ms</p>
                </div>
            </div>
        </div>
    );
}
