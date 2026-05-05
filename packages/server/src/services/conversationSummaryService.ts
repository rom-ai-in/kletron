import type { AgentEvent } from "@kletron/shared/types";
import type { AgentConversationSummary, AgentGraphState } from "./agentGraphTypes";
import { sanitizeAssistantVisibleContent, stripThoughtTagsForTranscript } from "./titleSanitizer";

export const CONVERSATION_SUMMARY_THRESHOLD = 60;
export const CONVERSATION_RECENT_WINDOW = 30;
const MAX_EVENT_SNIPPET_CHARS = 240;
const MAX_SUMMARY_CHARS = 4000;

function sanitizeText(value?: string): string {
    const cleaned = sanitizeAssistantVisibleContent(stripThoughtTagsForTranscript(value ?? "")).trim();
    if (!cleaned) return "";
    return cleaned.replace(/\s+/g, " ").slice(0, MAX_EVENT_SNIPPET_CHARS);
}

function summarizeEvent(event: AgentEvent): string | null {
    if (event.kind === "system") return null;
    if (event.kind === "user") {
        const text = sanitizeText(event.content);
        return text ? `User: ${text}` : null;
    }
    if (event.kind === "assistant") {
        const text = sanitizeText(event.content);
        if (text) return `Assistant: ${text}`;
        if (event.name || event.toolName) {
            return `Assistant tool call: ${event.name || event.toolName}`;
        }
        return null;
    }
    if (event.kind === "tool") {
        const text = sanitizeText(event.content);
        if (!text) return event.name || event.toolName ? `Tool: ${event.name || event.toolName}` : null;
        const toolName = event.name || event.toolName || "tool";
        return `Tool ${toolName}: ${text}`;
    }
    return null;
}

function clampSummary(text: string): string {
    if (text.length <= MAX_SUMMARY_CHARS) return text;
    const headBudget = Math.floor(MAX_SUMMARY_CHARS * 0.6);
    const tailBudget = MAX_SUMMARY_CHARS - headBudget - 5;
    return `${text.slice(0, headBudget).trimEnd()}\n...\n${text.slice(-tailBudget).trimStart()}`;
}

function mergeSummary(existingSummary: string | undefined, lines: string[]): string {
    const deduped = lines.filter(Boolean);
    const parts = existingSummary ? [existingSummary, ...deduped] : deduped;
    return clampSummary(parts.join("\n"));
}

export function ensureConversationSummary(
    state: AgentGraphState,
    opts?: { threshold?: number; recentWindow?: number },
): {
    conversationSummary?: AgentConversationSummary;
    recentHistory: AgentEvent[];
} {
    const threshold = opts?.threshold ?? CONVERSATION_SUMMARY_THRESHOLD;
    const recentWindow = opts?.recentWindow ?? CONVERSATION_RECENT_WINDOW;
    const history = state.conversationHistory ?? [];

    if (history.length <= threshold) {
        return {
            conversationSummary: state.conversationSummary,
            recentHistory: history,
        };
    }

    const targetCoveredEventCount = Math.max(0, history.length - recentWindow);
    const existing = state.conversationSummary;
    const existingCovered = Math.max(0, existing?.coveredEventCount ?? 0);

    let nextSummary = existing?.summary;
    if (targetCoveredEventCount > existingCovered) {
        const unseenSlice = history.slice(existingCovered, targetCoveredEventCount);
        const lines = unseenSlice.map(summarizeEvent).filter((value): value is string => Boolean(value));
        nextSummary = mergeSummary(nextSummary, lines);
    }

    if (nextSummary && nextSummary.trim().length > 0) {
        state.conversationSummary = {
            summary: nextSummary.trim(),
            coveredEventCount: targetCoveredEventCount,
            updatedAt: new Date().toISOString(),
        };
    }

    return {
        conversationSummary: state.conversationSummary,
        recentHistory: history.slice(targetCoveredEventCount),
    };
}

export function formatConversationSummaryPrompt(
    conversationSummary?: AgentConversationSummary,
): string | null {
    if (!conversationSummary?.summary?.trim()) return null;
    return [
        "THREAD SUMMARY:",
        `- Covered events: ${conversationSummary.coveredEventCount}`,
        conversationSummary.summary,
    ].join("\n");
}
