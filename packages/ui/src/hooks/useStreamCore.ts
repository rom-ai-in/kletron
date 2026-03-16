// ─── Unified Streaming Core ───────────────────────────────────────────────────
// Extracts common NDJSON parsing, event dedup, and chunk processing shared
// between desktop (useConversation.ts) and web (useSessionStream.ts).
//
// This is the single source of truth for:
//  - NDJSON line parsing with error recovery
//  - Message event deduplication (ID-based + content fingerprint)
//  - Stream lifecycle management (abort, reconnect)

import type { StreamChunk } from '@numezis/shared/chatTypes';

// ═══════════════════════════════════════════════════════════════════════════════
// NDJSON Parser — shared between desktop and web streaming implementations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a single NDJSON line into a StreamChunk.
 * Returns null for blank lines or unparseable JSON.
 */
export function parseNdjsonLine(line: string): StreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed) as StreamChunk;
    } catch {
        console.warn('[useStreamCore] Failed to parse NDJSON line:', trimmed.slice(0, 100));
        return null;
    }
}

/**
 * Async generator that reads a ReadableStream line-by-line, yielding
 * parsed StreamChunk objects. Handles partial line buffering.
 */
export async function* parseNdjsonStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<StreamChunk, void, unknown> {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            const chunk = parseNdjsonLine(line);
            if (chunk) yield chunk;
        }
    }

    // Flush any remaining buffer
    if (buffer.trim()) {
        const chunk = parseNdjsonLine(buffer);
        if (chunk) yield chunk;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Deduplicator — bounded LRU-style set for message dedup
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_MAX_SEEN = 500;

/**
 * Creates a bounded deduplication tracker.
 * Uses event IDs as primary keys, falls back to content fingerprints.
 * Old entries are evicted when the set exceeds maxSize.
 */
export function createEventDeduplicator(maxSize = DEFAULT_MAX_SEEN) {
    const seen = new Set<string>();
    const insertionOrder: string[] = [];

    function evictOldest() {
        while (seen.size > maxSize && insertionOrder.length > 0) {
            const oldest = insertionOrder.shift()!;
            seen.delete(oldest);
        }
    }

    /**
     * Returns true if the key has been seen before.
     * Adds it to the seen set if not.
     */
    function isDuplicate(key: string): boolean {
        if (seen.has(key)) return true;
        seen.add(key);
        insertionOrder.push(key);
        evictOldest();
        return false;
    }

    /**
     * Generate a fingerprint for content-based dedup when no ID is available.
     */
    function fingerprint(role: string, content: string, toolName?: string): string {
        const contentKey = content.slice(0, 200).replace(/\s+/g, ' ').trim();
        return `${role}:${toolName ?? ''}:${contentKey}`;
    }

    function clear() {
        seen.clear();
        insertionOrder.length = 0;
    }

    return { isDuplicate, fingerprint, clear, get size() { return seen.size; } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stream Reconnection — exponential backoff with configurable retries
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReconnectOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}

/**
 * Calculate the delay for the nth retry using exponential backoff with jitter.
 */
export function getReconnectDelay(
    retryCount: number,
    { baseDelayMs = 1000, maxDelayMs = 8000 }: ReconnectOptions = {},
): number {
    const exponential = baseDelayMs * Math.pow(2, retryCount);
    const jitter = Math.random() * baseDelayMs * 0.5;
    return Math.min(exponential + jitter, maxDelayMs);
}
