/**
 * GET /api/metrics
 * Prometheus-compatible metrics endpoint.
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { usageLogs, providers, models } from "@/db/schema";

export async function GET() {
    try {
        // Aggregate metrics from usage_logs
        const stats = await db.execute(sql`
      SELECT 
        p.name as provider_name,
        m.public_name as model_name,
        COUNT(*) as request_count,
        SUM(ul.input_tokens) as total_input_tokens,
        SUM(ul.output_tokens) as total_output_tokens,
        AVG(ul.latency) as avg_latency,
        SUM(CASE WHEN ul.status_code >= 200 AND ul.status_code < 300 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN ul.status_code >= 400 THEN 1 ELSE 0 END) as error_count
      FROM ${usageLogs} ul
      LEFT JOIN ${providers} p ON ul.provider_id = p.id
      LEFT JOIN ${models} m ON ul.model_id = m.id
      WHERE ul.created_at > NOW() - INTERVAL '1 hour'
      GROUP BY p.name, m.public_name
    `);

        // Format as Prometheus text
        let output = "";
        output += "# HELP ai_gateway_requests_total Total requests\n";
        output += "# TYPE ai_gateway_requests_total counter\n";
        output += "# HELP ai_gateway_latency_seconds Average latency\n";
        output += "# TYPE ai_gateway_latency_seconds gauge\n";
        output += "# HELP ai_gateway_tokens_total Total tokens\n";
        output += "# TYPE ai_gateway_tokens_total counter\n";

        for (const row of stats as unknown as Array<Record<string, unknown>>) {
            const provider = String(row.provider_name || "unknown");
            const model = String(row.model_name || "unknown");
            const labels = `provider="${provider}",model="${model}"`;

            output += `ai_gateway_requests_total{${labels},status="success"} ${row.success_count || 0}\n`;
            output += `ai_gateway_requests_total{${labels},status="error"} ${row.error_count || 0}\n`;
            output += `ai_gateway_latency_seconds{${labels}} ${((row.avg_latency as number) || 0) / 1000}\n`;
            output += `ai_gateway_tokens_total{${labels},direction="input"} ${row.total_input_tokens || 0}\n`;
            output += `ai_gateway_tokens_total{${labels},direction="output"} ${row.total_output_tokens || 0}\n`;
        }

        return new Response(output, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
        });
    } catch (err) {
        return NextResponse.json(
            { error: "Failed to collect metrics" },
            { status: 500 }
        );
    }
}
