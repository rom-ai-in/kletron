import { config } from "../config";
import { agentGraphService } from "./agentGraphService";
import type { AgentGraphDefinition } from "./agentGraphTypes";

/**
 * A subagent is just a graph that opted in via `subagent.key`.
 *
 * This is what keeps the graph catalog load-bearing: `task({ subagent_type })`
 * resolves against the workspace's own graphs, so the graph editor doubles as
 * the subagent editor and customers can author their own without code changes.
 */
export type ResolvedSubagent = {
    key: string;
    graphId: string;
    label: string;
    whenToUse: string;
    systemPrompt: string;
    userPromptTemplate: string;
    toolNames: string[];
    skillIds: string[];
    /** v1 is always true — subagents have no HITL approval path, so they cannot write. */
    readOnly: boolean;
    allowExec: boolean;
    maxSteps: number;
};

const CACHE_TTL_MS = 30_000;

type CacheEntry = { at: number; value: ResolvedSubagent[] };

const cache = new Map<string, CacheEntry>();

/** Exposed for tests — clears the short-lived per-workspace cache. */
export function clearSubagentRegistryCache(): void {
    cache.clear();
}

function toResolvedSubagent(graph: AgentGraphDefinition): ResolvedSubagent | null {
    const key = graph.subagent?.key?.trim();
    if (!key) return null;
    const graphId = graph._id?.toString();
    if (!graphId) return null;

    // A subagent runs a single ReAct node. Multi-node graphs are still valid
    // graphs, but only their entry node is meaningful as a subagent body.
    const node = graph.nodes?.[0];
    if (!node?.react) return null;

    return {
        key,
        graphId,
        label: graph.name,
        whenToUse: graph.subagent?.whenToUse?.trim() || graph.description?.trim() || graph.name,
        systemPrompt: node.react.systemPrompt ?? "",
        userPromptTemplate: node.react.userPromptTemplate ?? "{{mission}}",
        toolNames: [...(node.react.toolNames ?? [])],
        skillIds: [...(node.react.skillIds ?? [])],
        // v1: readOnly is forced on regardless of what the document says, because
        // a subagent has no checkpoint thread and therefore no way to pause for
        // human approval on a write. `allowExec` is the one audited exception.
        readOnly: true,
        allowExec: graph.subagent?.allowExec === true,
        maxSteps:
            typeof graph.subagent?.maxSteps === "number" && graph.subagent.maxSteps > 0
                ? Math.floor(graph.subagent.maxSteps)
                : config.subagents.maxSteps,
    };
}

/**
 * All subagents available to a workspace, sorted by key for a stable tool
 * description (the description is part of the prompt — it must not churn
 * between turns or it invalidates prompt caching).
 */
export async function listSubagents(workspaceId?: string): Promise<ResolvedSubagent[]> {
    const cacheKey = workspaceId ?? "__global__";
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    let graphs: AgentGraphDefinition[] = [];
    try {
        graphs = await agentGraphService.listGraphs();
    } catch (error) {
        console.warn("[Subagents] Failed to list graphs:", (error as Error)?.message ?? error);
        return [];
    }

    const resolved: ResolvedSubagent[] = [];
    const seen = new Set<string>();
    for (const graph of graphs) {
        const subagent = toResolvedSubagent(graph);
        if (!subagent) continue;
        // First graph wins on duplicate keys — deterministic given the sort below.
        if (seen.has(subagent.key)) {
            console.warn(`[Subagents] Duplicate subagent key "${subagent.key}" — ignoring graph ${subagent.graphId}.`);
            continue;
        }
        seen.add(subagent.key);
        resolved.push(subagent);
    }

    resolved.sort((a, b) => a.key.localeCompare(b.key));
    cache.set(cacheKey, { at: Date.now(), value: resolved });
    return resolved;
}

export async function resolveSubagent(
    key: string,
    workspaceId?: string
): Promise<ResolvedSubagent | null> {
    const needle = key?.trim();
    if (!needle) return null;
    const all = await listSubagents(workspaceId);
    return all.find((s) => s.key === needle) ?? null;
}

/**
 * Builds the `task` tool description. The `whenToUse` lines are what actually
 * teach the model which subagent to pick, so they are part of the prompt.
 */
export function buildTaskToolDescription(subagents: ResolvedSubagent[]): string {
    const lines = subagents.map((s) => `- \`${s.key}\`: ${s.whenToUse}`);
    return [
        "Delegate a self-contained piece of work to a subagent with its own isolated context window.",
        "",
        "Available subagents:",
        ...lines,
        "",
        "When to use it:",
        "- Fan out across independent questions, files, or areas — emit ALL independent `task` calls in a SINGLE turn so they run in parallel.",
        "- Verify a conclusion by asking a skeptical subagent to refute it.",
        "",
        "When NOT to use it:",
        "- Work you can finish directly in this turn (reading one file, editing code you can already see).",
        "- Anything that writes: subagents are read-only. Do the edits yourself.",
        "",
        "The subagent sees ONLY your `prompt` — not this conversation. Make it self-contained and state exactly what you want back.",
    ].join("\n");
}
