import { describe, expect, it } from "vitest";
import {
    alignAutomationStagesToWorkspaceGraphs,
    automationStagesNeedGraphAlignment,
    CANONICAL_AGENT_GRAPH_IDS,
    remapCanonicalGraphIdToWorkspaceGraph,
} from "../src/canonicalStageGraphs";

describe("canonicalStageGraphs", () => {
    it("remaps canonical hex to workspace id when names match but ids differ", () => {
        const graphs = [
            { id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Explorer Agent (agent graph)" },
            { id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Coder Agent (agent graph)" },
        ];
        const out = remapCanonicalGraphIdToWorkspaceGraph(CANONICAL_AGENT_GRAPH_IDS.EXPLORER, graphs);
        expect(out).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
    });

    it("keeps canonical hex when that id exists in the workspace list", () => {
        const graphs = [{ id: CANONICAL_AGENT_GRAPH_IDS.PLANNER, name: "Planner Agent (agent graph)" }];
        expect(remapCanonicalGraphIdToWorkspaceGraph(CANONICAL_AGENT_GRAPH_IDS.PLANNER, graphs)).toBe(
            CANONICAL_AGENT_GRAPH_IDS.PLANNER
        );
    });

    it("alignAutomationStagesToWorkspaceGraphs replaces audit and aligns hex", () => {
        const graphs = [{ id: "live-explorer", name: "Explorer Agent (agent graph)" }];
        const stages = alignAutomationStagesToWorkspaceGraphs(
            [
                {
                    id: "s1",
                    name: "A",
                    graphId: "audit",
                    llmProvider: "azure",
                    prompt: "x",
                },
                {
                    id: "s2",
                    name: "B",
                    graphId: CANONICAL_AGENT_GRAPH_IDS.CODER,
                    llmProvider: "lmstudio",
                    prompt: "y",
                },
            ],
            graphs
        );
        expect(stages[0].graphId).toBe("live-explorer");
        expect(stages[0].llmProvider).toBe("lmstudio");
        expect(automationStagesNeedGraphAlignment(stages, graphs)).toBe(false);
    });
});
