import type { AutomationStageConfig } from "./automationTypes";

/**
 * Stable 24-char ObjectId strings for seeded canonical graphs
 * (see packages/server/src/services/agentGraphService.ts ensureFallbackGraphs).
 */
export const CANONICAL_AGENT_GRAPH_IDS = {
    CODER: "000000000000000000000008",
    EXPLORER: "000000000000000000000009",
    PLANNER: "00000000000000000000000a",
    COMPANY_GROWTH_GTM: "00000000000000000000000e",
} as const;

export type CanonicalStageGraphRole = "coder" | "explorer" | "planner" | "company_growth";

const ROLE_TO_GRAPH_NAME: Record<CanonicalStageGraphRole, string> = {
    coder: "Coder Agent (agent graph)",
    explorer: "Explorer Agent (agent graph)",
    planner: "Planner Agent (agent graph)",
    company_growth: "Company Growth & GTM (work graph)",
};

const ROLE_TO_FALLBACK_ID: Record<CanonicalStageGraphRole, string> = {
    coder: CANONICAL_AGENT_GRAPH_IDS.CODER,
    explorer: CANONICAL_AGENT_GRAPH_IDS.EXPLORER,
    planner: CANONICAL_AGENT_GRAPH_IDS.PLANNER,
    company_growth: CANONICAL_AGENT_GRAPH_IDS.COMPANY_GROWTH_GTM,
};

/**
 * Resolve graph document id for a stage role using the list from GET /api/agent-graphs,
 * falling back to canonical hex ids when the list is empty or names differ.
 */
export function resolveStageGraphId(
    graphs: { id: string; name: string }[],
    role: CanonicalStageGraphRole
): string {
    const needle = ROLE_TO_GRAPH_NAME[role];
    const hit = graphs.find((g) => g.name === needle);
    if (hit?.id) return hit.id;
    return ROLE_TO_FALLBACK_ID[role];
}

const LEGACY_STAGE_GRAPH_IDS = new Set(["audit", "simple_react"]);

/**
 * When opening an automation that still references legacy graph keys, remap to Explorer + LM Studio
 * once real graph ids are available.
 */
export function normalizeLegacyAutomationStages(
    stages: AutomationStageConfig[] | undefined,
    graphs: { id: string; name: string }[]
): AutomationStageConfig[] {
    if (!stages?.length) return stages ?? [];
    return stages.map((s) => {
        if (!LEGACY_STAGE_GRAPH_IDS.has(s.graphId || "")) return s;
        return {
            ...s,
            graphId: resolveStageGraphId(graphs, "explorer"),
            llmProvider: "lmstudio",
        };
    });
}

export function automationStagesNeedLegacyGraphMigration(stages: AutomationStageConfig[] | undefined): boolean {
    if (!stages?.length) return false;
    return stages.some((s) => LEGACY_STAGE_GRAPH_IDS.has(s.graphId || ""));
}
