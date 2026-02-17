/**
 * POST /v1/chat/completions
 * Main proxy endpoint for chat completions.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, validateApiKey } from "@/lib/auth/api-key";
import { checkRateLimit, checkGlobalRateLimit } from "@/lib/auth/rate-limiter";
import { resolveRoute } from "@/lib/proxy/router";
import { buildUpstreamRequest } from "@/lib/proxy/request-builder";
import { createStreamingTransformer } from "@/lib/proxy/streaming";
import { normalizeResponse } from "@/lib/proxy/normalizer";
import { recordSuccess, recordFailure } from "@/lib/rotation/account-rotation";
import { Errors, handleProxyError } from "@/lib/errors";
import { createLogger, generateRequestId } from "@/lib/logger";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";

const log = createLogger("v1/chat/completions");

export async function POST(req: NextRequest) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
        // 1. Authenticate
        const token = extractBearerToken(req.headers.get("authorization"));
        if (!token) throw Errors.unauthorized();

        const apiKey = await validateApiKey(token);
        if (!apiKey) throw Errors.unauthorized();

        // 2. Rate limit
        const globalLimit = checkGlobalRateLimit(1000, 60_000);
        if (!globalLimit.allowed) throw Errors.rateLimited();

        const keyLimit = checkRateLimit(
            apiKey.id,
            apiKey.rateLimit,
            60_000
        );
        if (!keyLimit.allowed) throw Errors.rateLimited();

        // 3. Parse request body
        const body = (await req.json()) as Record<string, unknown>;
        const modelName = body.model as string;
        if (!modelName) throw Errors.badRequest("Missing 'model' field");

        const streaming = body.stream === true;

        // 4. Resolve route
        const route = await resolveRoute(modelName);

        // 5. Check streaming support
        if (streaming && !route.model.supportsStreaming) {
            throw Errors.badRequest(
                `Model '${modelName}' does not support streaming`
            );
        }

        // 6. Build upstream request
        const upstream = buildUpstreamRequest(
            route,
            body,
            "/v1/chat/completions",
            requestId,
            streaming
        );

        // 7. Execute upstream request
        const response = await fetch(upstream.url, upstream.init);

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            log.error("Upstream request failed", {
                requestId,
                status: response.status,
                error: errorText.slice(0, 500),
            });

            if (route.oauthAccount) {
                recordFailure(route.oauthAccount.id);
            }

            throw Errors.providerError(
                `Upstream provider returned ${response.status}`,
                errorText
            );
        }

        if (route.oauthAccount) {
            recordSuccess(route.oauthAccount.id);
        }

        // 8. Handle response
        if (streaming && response.body) {
            const transformer = createStreamingTransformer(
                route.provider.type,
                route.model.publicName,
                requestId
            );

            const stream = response.body.pipeThrough(transformer);

            // Log usage asynchronously (tokens estimated from streaming)
            logUsage(
                apiKey.id,
                route.provider.id,
                route.model.id,
                0,
                0,
                Date.now() - startTime,
                200
            );

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                    "X-Request-ID": requestId,
                },
            });
        }

        // Non-streaming response
        const upstreamJson = (await response.json()) as Record<string, unknown>;
        const normalized = normalizeResponse(
            upstreamJson,
            route.provider.type,
            route.model.publicName
        );

        // Log usage
        logUsage(
            apiKey.id,
            route.provider.id,
            route.model.id,
            normalized.usage.prompt_tokens,
            normalized.usage.completion_tokens,
            Date.now() - startTime,
            200
        );

        return NextResponse.json(normalized, {
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

// Non-blocking usage log insert
function logUsage(
    apiKeyId: string,
    providerId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    latency: number,
    statusCode: number
) {
    db.insert(usageLogs)
        .values({
            apiKeyId,
            providerId,
            modelId,
            inputTokens,
            outputTokens,
            latency,
            statusCode,
        })
        .then(() => { })
        .catch((err: unknown) =>
            log.error("Failed to log usage", { error: String(err) })
        );
}
