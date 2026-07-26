/**
 * Tool names valid on agent graph nodes for API validation.
 *
 * MCP-backed names come from {@link @kletron/agent-core/tools/mcpTools allMcpTools} at runtime;
 * these are executor-local or special tools referenced by presets but not in `allMcpTools`.
 */
export const EXECUTOR_ONLY_AGENT_GRAPH_TOOLS = [
    "write_todos",
    "list_available_skills",
    "load_skill",
    /** Delegation to subagents with isolated context windows (see `subagentRunner`). */
    "task",
] as const;

/** Build the full allowlist used by POST/PATCH `/api/agent-graphs`. */
export function createGraphValidToolNameSet(mcpToolNames: Iterable<string>): Set<string> {
    return new Set<string>([...mcpToolNames, ...EXECUTOR_ONLY_AGENT_GRAPH_TOOLS]);
}
