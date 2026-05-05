import { describe, expect, it } from "vitest";
import {
    AUTOMATION_EXEC_CONTEXT_MAX_BLOCKED_TOOLS,
    collectToolsAndSkillsFromGraph,
    partitionToolsByCapability,
} from "../src/services/automationExecutionContextService";
import type { AgentGraphDefinition } from "../src/services/agentGraphTypes";

function minimalGraph(
    nodes: AgentGraphDefinition["nodes"]
): AgentGraphDefinition {
    return {
        name: "Test graph",
        createdAt: new Date(),
        updatedAt: new Date(),
        nodes,
        edges: [],
    };
}

describe("automationExecutionContextService", () => {
    it("collectToolsAndSkillsFromGraph dedupes and sorts", () => {
        const graph = minimalGraph([
            {
                id: "a",
                label: "A",
                react: {
                    systemPrompt: "s",
                    userPromptTemplate: "{{mission}}",
                    toolNames: ["read_file", "search_code", "read_file"],
                    skillIds: ["audit", "review", "audit"],
                },
                output: { schemaId: "conversational" },
            },
            {
                id: "b",
                label: "B",
                react: {
                    systemPrompt: "s2",
                    userPromptTemplate: "{{mission}}",
                    toolNames: ["list_files"],
                },
                output: { schemaId: "conversational" },
            },
        ]);
        const { tools, skillIds } = collectToolsAndSkillsFromGraph(graph);
        expect(tools).toEqual(["list_files", "read_file", "search_code"]);
        expect(skillIds).toEqual(["audit", "review"]);
    });

    it("partitionToolsByCapability splits granted vs blocked", () => {
        const enabled = new Set(["a", "c"]);
        const { effective, blocked } = partitionToolsByCapability(["a", "b", "c"], enabled);
        expect(effective).toEqual(["a", "c"]);
        expect(blocked).toEqual(["b"]);
    });

    it("MAX_BLOCKED sample constant matches service slice bound", () => {
        expect(AUTOMATION_EXEC_CONTEXT_MAX_BLOCKED_TOOLS).toBe(20);
    });
});
