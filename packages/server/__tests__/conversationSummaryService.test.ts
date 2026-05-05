import { describe, expect, it } from "vitest";
import { ensureConversationSummary } from "../src/services/conversationSummaryService";
import type { AgentGraphState } from "../src/services/agentGraphTypes";

function makeEvent(index: number) {
    return {
        id: `event-${index}`,
        phaseId: index % 2 === 0 ? "user" : "assistant",
        phaseLabel: index % 2 === 0 ? "User input" : "Assistant reply",
        kind: index % 2 === 0 ? "user" : "assistant",
        role: index % 2 === 0 ? "user" : "assistant",
        content: index % 2 === 0 ? `User asks ${index}` : `Assistant answers ${index}`,
        timestamp: new Date(2026, 4, 5, 8, 0, index).toISOString(),
    } as const;
}

describe("conversationSummaryService", () => {
    it("creates a summary only after the threshold and keeps a recent raw window", () => {
        const state: AgentGraphState = {
            nodes: {},
            conversationHistory: Array.from({ length: 65 }, (_, index) => makeEvent(index)),
        };

        const result = ensureConversationSummary(state);

        expect(result.conversationSummary?.coveredEventCount).toBe(35);
        expect(result.recentHistory).toHaveLength(30);
        expect(result.conversationSummary?.summary).toContain("User asks 0");
        expect(result.recentHistory[0]?.content).toBe("Assistant answers 35");
    });
});
