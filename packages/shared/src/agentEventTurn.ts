import type { AgentEvent } from './types';

/**
 * Last non-tool assistant message after the most recent user message in chronological order.
 * Used to anchor streaming text deltas to the current turn — not the previous assistant reply.
 */
export function lastPlainAssistantAfterLatestUser(events: AgentEvent[]): AgentEvent | undefined {
    let lastUserIdx = -1;
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].kind === 'user') {
            lastUserIdx = i;
            break;
        }
    }
    if (lastUserIdx < 0) return undefined;

    let candidate: AgentEvent | undefined;
    for (let i = lastUserIdx + 1; i < events.length; i++) {
        const e = events[i];
        if (e.kind === 'assistant' && !(e.name ?? e.toolName) && !e.toolCallId) {
            candidate = e;
        }
    }
    return candidate;
}
