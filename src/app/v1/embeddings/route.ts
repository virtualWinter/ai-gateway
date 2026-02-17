/**
 * POST /v1/embeddings
 * Embeddings proxy endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, validateApiKey } from "@/lib/auth/api-key";
import { checkRateLimit, checkGlobalRateLimit } from "@/lib/auth/rate-limiter";
import { resolveRoute } from "@/lib/proxy/router";
import { buildUpstreamRequest } from "@/lib/proxy/request-builder";
import { Errors, handleProxyError } from "@/lib/errors";
import { createLogger, generateRequestId } from "@/lib/logger";

const log = createLogger("v1/embeddings");

export async function POST(req: NextRequest) {
    const requestId = generateRequestId();

    try {
        const token = extractBearerToken(req.headers.get("authorization"));
        if (!token) throw Errors.unauthorized();

        const apiKey = await validateApiKey(token);
        if (!apiKey) throw Errors.unauthorized();

        const globalLimit = checkGlobalRateLimit(1000, 60_000);
        if (!globalLimit.allowed) throw Errors.rateLimited();

        const keyLimit = checkRateLimit(apiKey.id, apiKey.rateLimit, 60_000);
        if (!keyLimit.allowed) throw Errors.rateLimited();

        const body = (await req.json()) as Record<string, unknown>;
        const modelName = body.model as string;
        if (!modelName) throw Errors.badRequest("Missing 'model' field");

        const route = await resolveRoute(modelName);

        const upstream = buildUpstreamRequest(
            route,
            body,
            "/v1/embeddings",
            requestId,
            false
        );

        const response = await fetch(upstream.url, upstream.init);

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw Errors.providerError(
                `Upstream provider returned ${response.status}`,
                errorText
            );
        }

        const json = await response.json();
        return NextResponse.json(json, {
            headers: { "X-Request-ID": requestId },
        });
    } catch (err) {
        log.error("Request failed", {
            requestId,
            error: err instanceof Error ? err.message : String(err),
        });
        return handleProxyError(err, requestId);
    }
}
