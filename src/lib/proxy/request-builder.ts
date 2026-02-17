/**
 * Upstream request builder.
 * Constructs fetch requests with proper headers, timeout, and abort handling.
 */

import { createLogger } from "@/lib/logger";
import { getAuthHeaders } from "./credential-loader";
import type { ResolvedRoute } from "./router";

const log = createLogger("request-builder");

export interface UpstreamRequest {
    url: string;
    init: RequestInit;
    controller: AbortController;
}

/**
 * Build the upstream URL for a given route and endpoint path.
 */
function buildUpstreamUrl(
    route: ResolvedRoute,
    endpointPath: string
): string {
    const base = route.provider.baseUrl.replace(/\/+$/, "");
    return `${base}${endpointPath}`;
}

/**
 * Translate an OpenAI request body to the upstream provider format.
 * For OpenAI-compatible providers, the body passes through mostly unchanged.
 * For other providers (Gemini, Anthropic), transformation is applied.
 */
function translateBody(
    body: Record<string, unknown>,
    route: ResolvedRoute
): Record<string, unknown> {
    const providerType = route.provider.type;

    // OpenAI-compatible providers: pass through with model name swap
    if (providerType === "openai" || providerType === "custom") {
        return {
            ...body,
            model: route.model.upstreamModelName,
        };
    }

    // Google/Gemini: translate to Gemini API format
    if (providerType === "google") {
        return translateToGemini(body, route);
    }

    // Anthropic: translate to Messages API format
    if (providerType === "anthropic") {
        return translateToAnthropic(body, route);
    }

    // OAuth providers: assume OpenAI format
    return {
        ...body,
        model: route.model.upstreamModelName,
    };
}

function translateToGemini(
    body: Record<string, unknown>,
    route: ResolvedRoute
): Record<string, unknown> {
    const messages = body.messages as Array<{
        role: string;
        content: string | Array<{ type: string; text?: string }>;
    }>;

    if (!messages) return body;

    // Convert OpenAI messages to Gemini contents format
    const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [
                {
                    text:
                        typeof m.content === "string"
                            ? m.content
                            : m.content
                                ?.filter((c) => c.type === "text")
                                .map((c) => c.text)
                                .join("\n") || "",
                },
            ],
        }));

    // Extract system message
    const systemMsg = messages.find((m) => m.role === "system");
    const systemInstruction = systemMsg
        ? {
            parts: [
                {
                    text:
                        typeof systemMsg.content === "string"
                            ? systemMsg.content
                            : systemMsg.content
                                ?.filter((c) => c.type === "text")
                                .map((c) => c.text)
                                .join("\n") || "",
                },
            ],
        }
        : undefined;

    const result: Record<string, unknown> = { contents };
    if (systemInstruction) {
        result.systemInstruction = systemInstruction;
    }

    // Map generation config
    if (body.temperature !== undefined || body.max_tokens !== undefined || body.top_p !== undefined) {
        result.generationConfig = {
            ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
            ...(body.max_tokens !== undefined ? { maxOutputTokens: body.max_tokens } : {}),
            ...(body.top_p !== undefined ? { topP: body.top_p } : {}),
        };
    }

    return result;
}

function translateToAnthropic(
    body: Record<string, unknown>,
    route: ResolvedRoute
): Record<string, unknown> {
    const messages = body.messages as Array<{
        role: string;
        content: string | Array<{ type: string; text?: string }>;
    }>;

    if (!messages) return body;

    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    return {
        model: route.model.upstreamModelName,
        messages: nonSystemMessages,
        ...(systemMsg
            ? {
                system:
                    typeof systemMsg.content === "string"
                        ? systemMsg.content
                        : systemMsg.content
                            ?.filter((c) => c.type === "text")
                            .map((c) => c.text)
                            .join("\n") || "",
            }
            : {}),
        ...(body.max_tokens ? { max_tokens: body.max_tokens } : { max_tokens: 4096 }),
        ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
        ...(body.top_p !== undefined ? { top_p: body.top_p } : {}),
        ...(body.stream !== undefined ? { stream: body.stream } : {}),
    };
}

/**
 * Get the upstream endpoint path for a given route and API endpoint.
 */
function getEndpointPath(
    route: ResolvedRoute,
    apiEndpoint: string
): string {
    const providerType = route.provider.type;

    if (providerType === "google") {
        const action =
            (apiEndpoint.includes("chat/completions") || apiEndpoint.includes("completions"))
                ? "generateContent"
                : "predict";
        return `/v1beta/models/${route.model.upstreamModelName}:${action}`;
    }

    if (providerType === "anthropic") {
        return "/v1/messages";
    }

    // OpenAI-compatible: use the same path
    return apiEndpoint;
}

/**
 * Build a complete upstream fetch request.
 */
export function buildUpstreamRequest(
    route: ResolvedRoute,
    body: Record<string, unknown>,
    apiEndpoint: string,
    requestId: string,
    streaming: boolean
): UpstreamRequest {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), route.provider.timeout);

    // Clear timeout when signal is aborted (cleanup)
    controller.signal.addEventListener("abort", () => clearTimeout(timeoutId), {
        once: true,
    });

    const endpointPath = getEndpointPath(route, apiEndpoint);
    const url = buildUpstreamUrl(route, endpointPath);

    // For Google streaming, use SSE parameter
    const finalUrl =
        route.provider.type === "google" && streaming
            ? url.replace(":generateContent", ":streamGenerateContent") + "?alt=sse"
            : url;

    const translatedBody = translateBody(
        { ...body, stream: streaming },
        route
    );

    const authHeaders = getAuthHeaders(route);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...authHeaders,
    };

    // Anthropic requires version header
    if (route.provider.type === "anthropic") {
        headers["anthropic-version"] = "2023-06-01";
    }

    log.info("Building upstream request", {
        requestId,
        provider: route.provider.name,
        model: route.model.upstreamModelName,
        url: finalUrl,
        streaming,
    });

    return {
        url: finalUrl,
        init: {
            method: "POST",
            headers,
            body: JSON.stringify(translatedBody),
            signal: controller.signal,
        },
        controller,
    };
}
