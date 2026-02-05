import type { AgentGraphEdge, AgentGraphNode } from "./agentGraphTypes";

export class AgentGraphValidationError extends Error {
    details: string[];
    constructor(message: string, details: string[]) {
        super(message);
        this.name = "AgentGraphValidationError";
        this.details = details;
    }
}

export function topoSortAgentGraph(nodes: AgentGraphNode[], edges: AgentGraphEdge[]): string[] {
    const nodeIds = new Set(nodes.map((n) => n.id));
    const details: string[] = [];

    // Validate edge references
    for (const edge of edges) {
        if (!nodeIds.has(edge.source)) details.push(`Edge ${edge.id} references unknown source node: ${edge.source}`);
        if (!nodeIds.has(edge.target)) details.push(`Edge ${edge.id} references unknown target node: ${edge.target}`);
    }
    if (details.length) {
        throw new AgentGraphValidationError("Invalid graph edges", details);
    }

    const inDegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const n of nodes) {
        inDegree.set(n.id, 0);
        outgoing.set(n.id, []);
    }
    for (const e of edges) {
        outgoing.get(e.source)!.push(e.target);
        inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
        if (degree === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length) {
        const id = queue.shift()!;
        result.push(id);
        for (const next of outgoing.get(id) ?? []) {
            const nextDegree = (inDegree.get(next) ?? 0) - 1;
            inDegree.set(next, nextDegree);
            if (nextDegree === 0) queue.push(next);
        }
    }

    if (result.length !== nodes.length) {
        throw new AgentGraphValidationError("Graph contains a cycle (not a DAG)", [
            `Expected ${nodes.length} nodes in topo order but got ${result.length}.`,
        ]);
    }

    return result;
}

