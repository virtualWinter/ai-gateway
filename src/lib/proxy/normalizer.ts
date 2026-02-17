/**
 * Response normalizer.
 * Converts upstream provider responses to OpenAI chat completion format.
 */

import { randomUUID } from "node:crypto";

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface OpenAIChatCompletion {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: "assistant";
            content: string;
        };
        finish_reason: string;
    }>;
    usage: OpenAIUsage;
}

/**
 * Normalize any upstream response to OpenAI chat completion format.
 */
export function normalizeResponse(
    upstream: Record<string, unknown>,
    providerType: string,
    model: string
): OpenAIChatCompletion {
    switch (providerType) {
        case "openai":
        case "custom":
        case "oauth":
            return normalizeOpenAI(upstream, model);
        case "google":
            return normalizeGemini(upstream, model);
        case "anthropic":
            return normalizeAnthropic(upstream, model);
        default:
            return normalizeOpenAI(upstream, model);
    }
}

function normalizeOpenAI(
    upstream: Record<string, unknown>,
    model: string
): OpenAIChatCompletion {
    // Already in OpenAI format — ensure required fields
    const usage = upstream.usage as Partial<OpenAIUsage> | undefined;
    return {
        id:
            (upstream.id as string) ||
            `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        object: "chat.completion",
        created: (upstream.created as number) || Math.floor(Date.now() / 1000),
        model: (upstream.model as string) || model,
        choices: (upstream.choices as OpenAIChatCompletion["choices"]) || [],
        usage: {
            prompt_tokens: usage?.prompt_tokens || 0,
            completion_tokens: usage?.completion_tokens || 0,
            total_tokens: usage?.total_tokens || 0,
        },
    };
}

function normalizeGemini(
    upstream: Record<string, unknown>,
    model: string
): OpenAIChatCompletion {
    const candidates = upstream.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
    }>;

    const usageMeta = upstream.usageMetadata as {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };

    const content =
        candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const finishReason = candidates?.[0]?.finishReason || "STOP";

    const finishReasonMap: Record<string, string> = {
        STOP: "stop",
        MAX_TOKENS: "length",
        SAFETY: "content_filter",
        RECITATION: "content_filter",
    };

    return {
        id: `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                message: {
                    role: "assistant",
                    content,
                },
                finish_reason: finishReasonMap[finishReason] || "stop",
            },
        ],
        usage: {
            prompt_tokens: usageMeta?.promptTokenCount || 0,
            completion_tokens: usageMeta?.candidatesTokenCount || 0,
            total_tokens: usageMeta?.totalTokenCount || 0,
        },
    };
}

function normalizeAnthropic(
    upstream: Record<string, unknown>,
    model: string
): OpenAIChatCompletion {
    const content = (
        upstream.content as Array<{
            type: string;
            text?: string;
        }>
    )
        ?.filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("") || "";

    const usage = upstream.usage as {
        input_tokens?: number;
        output_tokens?: number;
    };

    const stopReason = (upstream.stop_reason as string) || "end_turn";
    const stopReasonMap: Record<string, string> = {
        end_turn: "stop",
        max_tokens: "length",
        stop_sequence: "stop",
        tool_use: "tool_calls",
    };

    return {
        id: `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                message: {
                    role: "assistant",
                    content,
                },
                finish_reason: stopReasonMap[stopReason] || "stop",
            },
        ],
        usage: {
            prompt_tokens: usage?.input_tokens || 0,
            completion_tokens: usage?.output_tokens || 0,
            total_tokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
        },
    };
}
