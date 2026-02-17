/**
 * Structured error types mapping to OpenAI-compatible error responses.
 */

import { NextResponse } from "next/server";

export class ProxyError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly internal?: string
    ) {
        super(message);
        this.name = "ProxyError";
    }

    /**
     * Convert to OpenAI-compatible error JSON response.
     * Internal details are masked in production.
     */
    toResponse(requestId?: string): NextResponse {
        return NextResponse.json(
            {
                error: {
                    message: this.message,
                    type: this.code,
                    code: this.code,
                    ...(requestId ? { request_id: requestId } : {}),
                },
            },
            { status: this.statusCode }
        );
    }
}

// ── Pre-built error factories ──────────────────────────────────────────────

export const Errors = {
    unauthorized: (msg = "Invalid API key") =>
        new ProxyError(401, "invalid_api_key", msg),

    forbidden: (msg = "Access denied") =>
        new ProxyError(403, "forbidden", msg),

    notFound: (msg = "Resource not found") =>
        new ProxyError(404, "not_found", msg),

    rateLimited: (msg = "Rate limit exceeded") =>
        new ProxyError(429, "rate_limit_exceeded", msg),

    modelNotFound: (model: string) =>
        new ProxyError(404, "model_not_found", `Model '${model}' not found`),

    providerError: (msg: string, internal?: string) =>
        new ProxyError(502, "provider_error", msg, internal),

    timeout: (msg = "Request timed out") =>
        new ProxyError(504, "timeout", msg),

    internal: (msg = "Internal server error", internal?: string) =>
        new ProxyError(500, "internal_error", msg, internal),

    badRequest: (msg: string) =>
        new ProxyError(400, "bad_request", msg),
} as const;

/**
 * Wrap a route handler with structured error handling.
 */
export function handleProxyError(
    err: unknown,
    requestId?: string
): NextResponse {
    if (err instanceof ProxyError) {
        return err.toResponse(requestId);
    }

    const message =
        process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err instanceof Error
                ? err.message
                : "Unknown error";

    return Errors.internal(message).toResponse(requestId);
}
