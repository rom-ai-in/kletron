// ─── Tool Pairing Utility ─────────────────────────────────────────────────────
// Extracted from MessageList.tsx — single source of truth for:
//   - Detecting tool-related events (call vs result)
//   - Grouping consecutive tool events into batches
//   - Pairing call events with their result events
//
// Consumers: MessageList.tsx, ConversationCenter.tsx, useConversation.ts

import type { ChatEvent, RenderItem } from '@kletron/shared/chatTypes';

// Re-export types for convenience
export type { ChatEvent, RenderItem };

/**
 * A paired tool call + result. Either side can be missing
 * (orphaned call still awaiting result, or orphaned result).
 */
export interface ToolPair {
    call?: ChatEvent;
    result?: ChatEvent;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Detection helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Is this an AI message that issues a tool call (vs a tool result)?
 * Handles both NEW data (AI call → kind="assistant") and LEGACY data
 * (AI call → kind="tool" with toolArgs and empty content).
 */
export function isToolCallEvent(e: ChatEvent): boolean {
    // New format: assistant events with tool info
    if (e.kind === 'assistant' && Boolean(e.toolName)) return true;
    // Legacy format: kind="tool" with toolArgs and no meaningful content
    if (e.kind === 'tool' && e.toolArgs && !e.content?.trim()) return true;
    return false;
}

/**
 * Is this a tool-related event (either a call or a result)?
 */
export function isToolRelatedEvent(e: ChatEvent): boolean {
    if (isToolCallEvent(e)) return true;
    if (e.kind === 'tool') return true;
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Grouping — separates tool events from message events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Group a flat list of events into render items.
 * Consecutive tool-related events are batched into a `{ type: 'tools' }` item.
 * All other events become `{ type: 'event' }` items.
 */
export function groupEvents(events: ChatEvent[]): RenderItem[] {
    const items: RenderItem[] = [];
    let toolBuffer: ChatEvent[] = [];

    const flushTools = () => {
        if (toolBuffer.length > 0) {
            items.push({ type: 'tools', events: toolBuffer });
            toolBuffer = [];
        }
    };

    for (const event of events) {
        if (isToolRelatedEvent(event)) {
            toolBuffer.push(event);
            continue;
        }
        flushTools();
        items.push({ type: 'event', event });
    }
    flushTools();
    return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pairing — matches call events with their corresponding result events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Given a buffer of tool events, pair each assistant call with its
 * corresponding tool result. Matching priority:
 *  1. toolCallId match
 *  2. toolName match
 *  3. First unused result (fallback)
 */
export function pairToolEvents(events: ChatEvent[]): ToolPair[] {
    // Separate calls from results
    const calls: ChatEvent[] = [];
    const results: ChatEvent[] = [];
    for (const e of events) {
        if (isToolCallEvent(e)) calls.push(e);
        else results.push(e);
    }

    const pairs: ToolPair[] = [];
    const usedResults = new Set<number>();

    for (const call of calls) {
        // Try to match by toolCallId first, then by toolName
        let matchIdx = -1;
        if (call.toolCallId) {
            matchIdx = results.findIndex((r, i) => !usedResults.has(i) && r.toolCallId === call.toolCallId);
        }
        if (matchIdx === -1 && call.toolName) {
            matchIdx = results.findIndex((r, i) => !usedResults.has(i) && r.toolName === call.toolName);
        }
        if (matchIdx === -1) {
            // Grab the first unused result as a fallback
            matchIdx = results.findIndex((_, i) => !usedResults.has(i));
        }
        if (matchIdx >= 0) {
            usedResults.add(matchIdx);
            pairs.push({ call, result: results[matchIdx] });
        } else {
            pairs.push({ call });
        }
    }

    // Any unmatched results become their own pairs
    for (let i = 0; i < results.length; i++) {
        if (!usedResults.has(i)) {
            pairs.push({ result: results[i] });
        }
    }

    return pairs;
}
