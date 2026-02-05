import type { AgentGraphDefinition, AgentGraphExecutionMode, AgentGraphState } from "./agentGraphTypes";
import { topoSortAgentGraph } from "./agentGraphTopo";

export function resolveExecutionMode(graph: AgentGraphDefinition): AgentGraphExecutionMode {
    return graph.execution?.mode === "state_machine" ? "state_machine" : "dag";
}

export function getGraphNodeOrder(graph: AgentGraphDefinition): string[] {
    const mode = resolveExecutionMode(graph);
    if (mode === "dag") {
        return topoSortAgentGraph(graph.nodes, graph.edges);
    }
    return graph.nodes.map((n) => n.id);
}

export function getEntryNodeIds(graph: AgentGraphDefinition): string[] {
    const mode = resolveExecutionMode(graph);
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const entry = graph.execution?.entryNodeId;
    if (mode === "state_machine" && entry && nodeIds.has(entry)) {
        return [entry];
    }
    const incoming = new Set(graph.edges.map((e) => e.target));
    const roots = graph.nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id);
    if (roots.length > 0) return roots;
    const first = graph.nodes[0]?.id;
    return first ? [first] : [];
}

export function buildInitialState(graph: AgentGraphDefinition, mission: string): AgentGraphState {
    const defaults = (graph.stateDefaults ?? {}) as Record<string, unknown>;
    const defaultNodes = typeof defaults.nodes === "object" && defaults.nodes ? defaults.nodes : {};
    return {
        ...defaults,
        mission,
        userInput: mission,
        nodes: {
            ...(defaultNodes as Record<string, unknown>),
        },
        execution: {
            mode: resolveExecutionMode(graph),
        },
    } satisfies AgentGraphState;
}
