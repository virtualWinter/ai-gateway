/**
 * Structured JSON logger with request ID tracing.
 */

import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    requestId?: string;
    message: string;
    [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel =
    LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || "info"] ?? 1;

function emit(entry: LogEntry) {
    const levelNum = LOG_LEVELS[entry.level] ?? 1;
    if (levelNum < currentLevel) return;

    const line = JSON.stringify(entry);
    if (entry.level === "error") {
        console.error(line);
    } else if (entry.level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}

export function createLogger(scope: string) {
    const log = (
        level: LogLevel,
        message: string,
        meta?: Record<string, unknown>
    ) => {
        emit({
            timestamp: new Date().toISOString(),
            level,
            scope,
            message,
            ...meta,
        });
    };

    return {
        debug: (msg: string, meta?: Record<string, unknown>) =>
            log("debug", msg, meta),
        info: (msg: string, meta?: Record<string, unknown>) =>
            log("info", msg, meta),
        warn: (msg: string, meta?: Record<string, unknown>) =>
            log("warn", msg, meta),
        error: (msg: string, meta?: Record<string, unknown>) =>
            log("error", msg, meta),
    };
}

/** Generate a unique request ID for tracing */
export function generateRequestId(): string {
    return randomUUID();
}
