/**
 * POST /v1/completions
 * Legacy completions proxy endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, validateApiKey } from "@/lib/auth/api-key";
import { checkRateLimit, checkGlobalRateLimit } from "@/lib/auth/rate-limiter";
import { resolveRoute } from "@/lib/proxy/router";
import { buildUpstreamRequest } from "@/lib/proxy/request-builder";
import { createStreamingTransformer } from "@/lib/proxy/streaming";
import { recordSuccess, recordFailure } from "@/lib/rotation/account-rotation";
import { Errors, handleProxyError } from "@/lib/errors";
import { createLogger, generateRequestId } from "@/lib/logger";

const log = createLogger("v1/completions");

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

        const streaming = body.stream === true;
        const route = await resolveRoute(modelName);

        const upstream = buildUpstreamRequest(
            route,
            body,
            "/v1/completions",
            requestId,
            streaming
        );

        const response = await fetch(upstream.url, upstream.init);

        if (!response.ok) {
            if (route.oauthAccount) recordFailure(route.oauthAccount.id);
            const errorText = await response.text().catch(() => "Unknown error");
            throw Errors.providerError(
                `Upstream provider returned ${response.status}`,
                errorText
            );
        }

        if (route.oauthAccount) recordSuccess(route.oauthAccount.id);

        if (streaming && response.body) {
            const transformer = createStreamingTransformer(
                route.provider.type,
                route.model.publicName,
                requestId
            );
            return new Response(response.body.pipeThrough(transformer), {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                    "X-Request-ID": requestId,
                },
            });
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
