import type { AgentGraphDefinition, AgentGraphExecutionMode, AgentGraphState } from "./agentGraphTypes";
import { topoSortAgentGraph } from "./agentGraphTopo";

/**
 * Graphs execute as a DAG. The former `state_machine` mode (conditional edges
 * evaluated against run state) was never enabled by any shipped graph and has
 * been removed — runtime branching now happens *inside* a node through the
 * `task` tool rather than *between* nodes.
 */
export function resolveExecutionMode(_graph: AgentGraphDefinition): AgentGraphExecutionMode {
    return "dag";
}

export function getGraphNodeOrder(graph: AgentGraphDefinition): string[] {
    return topoSortAgentGraph(graph.nodes, graph.edges);
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
