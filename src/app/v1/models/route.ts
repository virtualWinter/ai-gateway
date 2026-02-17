/**
 * GET /v1/models
 * List all active models in OpenAI format.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { models, providers } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("v1/models");

export async function GET() {
    try {
        const rows = await db
            .select({
                id: models.publicName,
                providerId: providers.name,
                created: models.createdAt,
            })
            .from(models)
            .innerJoin(providers, eq(models.providerId, providers.id))
            .where(eq(models.isActive, true));

        const data = rows.map((row) => ({
            id: row.id,
            object: "model" as const,
            created: Math.floor(row.created.getTime() / 1000),
            owned_by: row.providerId,
        }));

        return NextResponse.json({
            object: "list",
            data,
        });
    } catch (err) {
        log.error("Failed to list models", {
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
            { error: { message: "Internal server error", type: "internal_error" } },
            { status: 500 }
        );
    }
}
