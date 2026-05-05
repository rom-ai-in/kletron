import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

import type { AgentEvent } from "@kletron/shared/types";

import { sanitizeAssistantVisibleContent, stripThoughtTagsForTranscript } from "./titleSanitizer";

function sanitizeEventContent(value?: string): string {
    const cleaned = sanitizeAssistantVisibleContent(stripThoughtTagsForTranscript(value ?? "")).trim();
    if (!cleaned) return "";
    if (
        /\brespond with only the title\b/i.test(cleaned) ||
        /\bwe need to produce a short chat title\b/i.test(cleaned)
    ) {
        return "";
    }
    return cleaned;
}

function isAiToolCallEvent(event: AgentEvent): boolean {
    if (event.kind === "assistant" && (event.name || event.toolName) && event.toolArgs) return true;
    if (event.kind === "tool" && event.toolArgs && !event.content?.trim()) return true;
    return false;
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function parseToolArgs(value: unknown): unknown {
    if (typeof value === "string") {
        try {
            return JSON.parse(value || "{}");
        } catch {
            return {};
        }
    }
    if (value && typeof value === "object") return value;
    return {};
}

type PendingAssistantText = {
    id: string;
    phaseId: string;
    content: string;
};

type PendingToolCall = {
    id: string;
    name: string;
    args: unknown;
    signature: string;
};

type PendingToolCallGroup = {
    id: string;
    content: string;
    toolCalls: PendingToolCall[];
};

export function convertConversationHistoryToMessages(events: AgentEvent[]): BaseMessage[] {
    const messages: BaseMessage[] = [];
    let pendingAssistantText: PendingAssistantText | null = null;
    let pendingToolCallGroup: PendingToolCallGroup | null = null;
    let openToolCallIds = new Set<string>();

    const flushAssistantText = () => {
        if (!pendingAssistantText) return;
        const content = pendingAssistantText.content.trim();
        if (content) {
            messages.push(new AIMessage({ content, id: pendingAssistantText.id }));
        }
        pendingAssistantText = null;
    };

    const flushToolCallGroup = () => {
        if (!pendingToolCallGroup) return;
        const msg = new AIMessage({
            content: pendingToolCallGroup.content || "",
            id: pendingToolCallGroup.id,
        });
        (msg as any).tool_calls = pendingToolCallGroup.toolCalls.map(({ id, name, args }) => ({
            id,
            name,
            args,
        }));
        messages.push(msg);
        openToolCallIds = new Set(
            pendingToolCallGroup.toolCalls
                .map((toolCall) => toolCall.id)
                .filter((id) => typeof id === "string" && id.length > 0),
        );
        pendingToolCallGroup = null;
    };

    const mergeAssistantText = (event: AgentEvent, content: string) => {
        if (!pendingAssistantText) {
            pendingAssistantText = {
                id: event.id,
                phaseId: event.phaseId,
                content,
            };
            return;
        }
        if (content === pendingAssistantText.content || content.startsWith(pendingAssistantText.content)) {
            pendingAssistantText.content = content;
            pendingAssistantText.phaseId = event.phaseId;
            return;
        }
        pendingAssistantText.content = `${pendingAssistantText.content}\n\n${content}`;
        pendingAssistantText.phaseId = event.phaseId;
    };

    for (const event of events) {
        if (event.kind === "user") {
            flushToolCallGroup();
            flushAssistantText();
            openToolCallIds.clear();
            const content = sanitizeEventContent(event.content);
            if (!content) continue;
            messages.push(new HumanMessage({ content, id: event.id }));
            continue;
        }

        if (event.kind === "system") {
            flushToolCallGroup();
            flushAssistantText();
            openToolCallIds.clear();
            const content = sanitizeEventContent(event.content);
            if (!content) continue;
            messages.push(new SystemMessage({ content, id: event.id }));
            continue;
        }

        if (isAiToolCallEvent(event)) {
            const toolName = String(event.toolName || event.name || "").trim();
            if (!toolName) continue;

            let foldedAssistantContent = "";
            const pendingAssistant = pendingAssistantText as PendingAssistantText | null;
            const pendingAssistantPhaseId = pendingAssistant ? pendingAssistant.phaseId : undefined;
            const pendingAssistantContent = pendingAssistant ? pendingAssistant.content : "";
            if (pendingAssistant) {
                if (!pendingToolCallGroup && pendingAssistantPhaseId === event.phaseId) {
                    foldedAssistantContent = pendingAssistantContent;
                    pendingAssistantText = null;
                } else {
                    flushAssistantText();
                }
            }

            const toolCallId = String(event.toolCallId || `call_${event.id}`);
            const toolArgs = parseToolArgs(event.toolArgs);
            const signature = `${toolName}:${stableStringify(toolArgs)}`;
            const toolNote = sanitizeEventContent(event.toolNote || event.content);

            if (!pendingToolCallGroup) {
                pendingToolCallGroup = {
                    id: foldedAssistantContent ? event.id : event.id,
                    content: foldedAssistantContent || toolNote,
                    toolCalls: [],
                };
            } else if (!pendingToolCallGroup.content && (foldedAssistantContent || toolNote)) {
                pendingToolCallGroup.content = foldedAssistantContent || toolNote;
            }

            const nextToolCall: PendingToolCall = {
                id: toolCallId,
                name: toolName,
                args: toolArgs,
                signature,
            };
            const existingIdx = pendingToolCallGroup.toolCalls.findIndex((toolCall) => toolCall.signature === signature);
            if (existingIdx >= 0) {
                pendingToolCallGroup.toolCalls[existingIdx] = nextToolCall;
            } else {
                pendingToolCallGroup.toolCalls.push(nextToolCall);
            }
            continue;
        }

        if (event.kind === "assistant") {
            flushToolCallGroup();
            openToolCallIds.clear();
            const content = sanitizeEventContent(event.content);
            if (!content) continue;
            mergeAssistantText(event, content);
            continue;
        }

        if (event.kind === "tool") {
            if (pendingToolCallGroup) {
                flushToolCallGroup();
            }
            if (pendingAssistantText) {
                flushAssistantText();
            }
            if (openToolCallIds.size === 0) continue;
            const toolCallId =
                event.toolCallId ||
                (openToolCallIds.size === 1 ? Array.from(openToolCallIds)[0] : "");
            if (!toolCallId) continue;
            if (!openToolCallIds.has(toolCallId)) continue;
            const content = sanitizeEventContent(event.content);
            messages.push(new ToolMessage({ content: content || "", tool_call_id: toolCallId, id: event.id }));
            openToolCallIds.delete(toolCallId);
        }
    }

    flushToolCallGroup();
    flushAssistantText();
    return messages;
}
