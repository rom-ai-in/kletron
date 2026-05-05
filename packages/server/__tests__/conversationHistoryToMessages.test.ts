import type { AgentEvent } from "@kletron/shared/types";
import { describe, expect, it } from "vitest";

import { convertConversationHistoryToMessages } from "../src/services/conversationHistoryToMessages";

function makeEvent(partial: Partial<AgentEvent> & Pick<AgentEvent, "id" | "kind" | "role" | "content">): AgentEvent {
    return {
        phaseId: "node-1",
        phaseLabel: "Test Node",
        timestamp: new Date().toISOString(),
        ...partial,
    };
}

describe("convertConversationHistoryToMessages", () => {
    it("folds assistant preamble into the following tool call", () => {
        const messages = convertConversationHistoryToMessages([
            makeEvent({
                id: "a1",
                kind: "assistant",
                role: "assistant",
                content: "Je regarde le fichier.",
            }),
            makeEvent({
                id: "a2",
                kind: "assistant",
                role: "assistant",
                name: "str_replace_editor",
                toolName: "str_replace_editor",
                toolCallId: "call-1",
                toolArgs: JSON.stringify({ path: "TASKS.md", command: "view" }),
                toolNote: "Je regarde le fichier.",
                content: "",
            }),
            makeEvent({
                id: "t1",
                kind: "tool",
                role: "tool",
                toolName: "str_replace_editor",
                toolCallId: "call-1",
                content: "1\t# TASKS",
            }),
        ]);

        expect(messages).toHaveLength(2);
        expect(messages[0].getType()).toBe("ai");
        expect((messages[0] as any).content).toBe("Je regarde le fichier.");
        expect((messages[0] as any).tool_calls?.length).toBe(1);
        expect((messages[0] as any).tool_calls?.[0]?.id).toBe("call-1");
        expect(messages[1].getType()).toBe("tool");
        expect((messages[1] as any).tool_call_id).toBe("call-1");
    });

    it("collapses duplicate approval replay tool calls and keeps the latest id for the matching tool result", () => {
        const messages = convertConversationHistoryToMessages([
            makeEvent({
                id: "a1",
                kind: "assistant",
                role: "assistant",
                name: "write_file",
                toolName: "write_file",
                toolCallId: "orig-call",
                toolArgs: JSON.stringify({ filePath: "meeting.md", content: "draft" }),
                content: "",
            }),
            makeEvent({
                id: "a2",
                kind: "assistant",
                role: "assistant",
                phaseId: "approval",
                phaseLabel: "Approved tool call",
                name: "write_file",
                toolName: "write_file",
                toolCallId: "approval-call",
                toolArgs: JSON.stringify({ filePath: "meeting.md", content: "draft" }),
                content: "",
            }),
            makeEvent({
                id: "t1",
                kind: "tool",
                role: "tool",
                phaseId: "approval",
                phaseLabel: "Approved tool result",
                toolName: "write_file",
                toolCallId: "approval-call",
                content: "{\"ok\":true}",
            }),
        ]);

        expect(messages).toHaveLength(2);
        expect(messages[0].getType()).toBe("ai");
        expect((messages[0] as any).tool_calls?.length).toBe(1);
        expect((messages[0] as any).tool_calls?.[0]?.id).toBe("approval-call");
        expect(messages[1].getType()).toBe("tool");
        expect((messages[1] as any).tool_call_id).toBe("approval-call");
    });

    it("drops orphan tool results that cannot be matched to a tool call", () => {
        const messages = convertConversationHistoryToMessages([
            makeEvent({
                id: "u1",
                kind: "user",
                role: "user",
                content: "hello",
            }),
            makeEvent({
                id: "t1",
                kind: "tool",
                role: "tool",
                toolName: "read_file",
                toolCallId: "missing-call",
                content: "orphan",
            }),
        ]);

        expect(messages).toHaveLength(1);
        expect(messages[0].getType()).toBe("human");
    });
});
