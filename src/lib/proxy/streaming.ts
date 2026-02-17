/**
 * SSE streaming transformer.
 * TransformStream that converts upstream provider SSE chunks to OpenAI format.
 */

import { randomUUID } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("streaming");

/**
 * Create a TransformStream that parses upstream SSE and emits OpenAI-format SSE.
 */
export function createStreamingTransformer(
    providerType: string,
    model: string,
    requestId: string
): TransformStream<Uint8Array, Uint8Array> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    const chatId = `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const created = Math.floor(Date.now() / 1000);

    return new TransformStream({
        transform(chunk, controller) {
            buffer += decoder.decode(chunk, { stream: true });

            const lines = buffer.split("\n");
            // Keep the last (potentially incomplete) line in the buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(":")) continue;

                if (trimmed === "data: [DONE]") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    continue;
                }

                if (!trimmed.startsWith("data:")) continue;

                const jsonStr = trimmed.slice(5).trim();
                if (!jsonStr) continue;

                try {
                    const parsed = JSON.parse(jsonStr);
                    const openaiChunk = transformChunk(
                        parsed,
                        providerType,
                        model,
                        chatId,
                        created
                    );

                    if (openaiChunk) {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
                        );
                    }
                } catch (err) {
                    log.warn("Failed to parse SSE chunk", {
                        requestId,
                        error: err instanceof Error ? err.message : String(err),
                        raw: jsonStr.slice(0, 200),
                    });
                }
            }
        },

        flush(controller) {
            // Process any remaining buffered data
            if (buffer.trim()) {
                const trimmed = buffer.trim();
                if (trimmed === "data: [DONE]") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
            }
            // Always emit [DONE] at the end
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        },
    });
}

/**
 * Transform a single parsed SSE chunk to OpenAI chat completion chunk format.
 */
function transformChunk(
    parsed: Record<string, unknown>,
    providerType: string,
    model: string,
    chatId: string,
    created: number
): Record<string, unknown> | null {
    switch (providerType) {
        case "openai":
        case "custom":
        case "oauth":
            // Already in OpenAI format — pass through
            return parsed;

        case "google":
            return transformGeminiChunk(parsed, model, chatId, created);

        case "anthropic":
            return transformAnthropicChunk(parsed, model, chatId, created);

        default:
            return parsed;
    }
}

function transformGeminiChunk(
    parsed: Record<string, unknown>,
    model: string,
    chatId: string,
    created: number
): Record<string, unknown> | null {
    const candidates = parsed.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
    }>;

    if (!candidates?.[0]) return null;

    const candidate = candidates[0];
    const text = candidate.content?.parts?.[0]?.text || "";
    const finishReason = candidate.finishReason
        ? mapGeminiFinishReason(candidate.finishReason)
        : null;

    return {
        id: chatId,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [
            {
                index: 0,
                delta: text ? { content: text } : {},
                finish_reason: finishReason,
            },
        ],
    };
}

function transformAnthropicChunk(
    parsed: Record<string, unknown>,
    model: string,
    chatId: string,
    created: number
): Record<string, unknown> | null {
    const type = parsed.type as string;

    if (type === "content_block_delta") {
        const delta = parsed.delta as { type?: string; text?: string };
        if (delta?.text) {
            return {
                id: chatId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [
                    {
                        index: 0,
                        delta: { content: delta.text },
                        finish_reason: null,
                    },
                ],
            };
        }
    }

    if (type === "message_delta") {
        const delta = parsed.delta as { stop_reason?: string };
        return {
            id: chatId,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [
                {
                    index: 0,
                    delta: {},
                    finish_reason: mapAnthropicStopReason(delta?.stop_reason || "end_turn"),
                },
            ],
        };
    }

    // Skip other event types (message_start, content_block_start, etc.)
    return null;
}

function mapGeminiFinishReason(reason: string): string {
    const map: Record<string, string> = {
        STOP: "stop",
        MAX_TOKENS: "length",
        SAFETY: "content_filter",
        RECITATION: "content_filter",
        OTHER: "stop",
    };
    return map[reason] || "stop";
}

function mapAnthropicStopReason(reason: string): string {
    const map: Record<string, string> = {
        end_turn: "stop",
        max_tokens: "length",
        stop_sequence: "stop",
        tool_use: "tool_calls",
    };
    return map[reason] || "stop";
}
