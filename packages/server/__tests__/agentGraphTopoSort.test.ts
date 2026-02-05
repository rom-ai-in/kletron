import { describe, it, expect } from "vitest";

import { topoSortAgentGraph } from "@numezis/server/services/agentGraphTopo";

describe("agentGraphTopo", () => {
    it("returns a valid topological order for a simple DAG", () => {
        const nodes: any[] = [
            { id: "a" },
            { id: "b" },
            { id: "c" },
        ];
        const edges: any[] = [
            { id: "e1", source: "a", target: "b" },
            { id: "e2", source: "b", target: "c" },
        ];
        const order = topoSortAgentGraph(nodes as any, edges as any);
        expect(order).toEqual(["a", "b", "c"]);
    });

    it("throws on cycles", () => {
        const nodes: any[] = [{ id: "a" }, { id: "b" }];
        const edges: any[] = [
            { id: "e1", source: "a", target: "b" },
            { id: "e2", source: "b", target: "a" },
        ];
        expect(() => topoSortAgentGraph(nodes as any, edges as any)).toThrow(/cycle/i);
    });

    it("throws when edges reference unknown nodes", () => {
        const nodes: any[] = [{ id: "a" }];
        const edges: any[] = [{ id: "e1", source: "a", target: "missing" }];
        expect(() => topoSortAgentGraph(nodes as any, edges as any)).toThrow(/invalid graph edges/i);
    });
});

