import type {
    AutomationExecutionContextDTO,
    AutomationExecutionContextStageDTO,
} from "@kletron/shared/automationExecutionContext";
import { automationExecutor } from "./automationExecutor";
import { agentGraphService } from "./agentGraphService";
import type { AgentGraphDefinition } from "./agentGraphTypes";
import { getWorkspaceByIdUnsafe } from "./workspaceService";
import { resolveWorkspaceCapabilities } from "./workspaceCapabilityResolver";

export const AUTOMATION_EXEC_CONTEXT_MAX_BLOCKED_TOOLS = 20;

/**
 * Collect distinct tool names and pinned skill ids from all ReAct nodes.
 */
export function collectToolsAndSkillsFromGraph(graph: AgentGraphDefinition): {
    tools: string[];
    skillIds: string[];
} {
    const toolSet = new Set<string>();
    const skillSet = new Set<string>();
    for (const node of graph.nodes) {
        const react = node.react;
        if (!react) continue;
        for (const t of react.toolNames ?? []) {
            if (typeof t === "string" && t.trim()) toolSet.add(t.trim());
        }
        for (const s of react.skillIds ?? []) {
            if (typeof s === "string" && s.trim()) skillSet.add(s.trim());
        }
    }
    return { tools: Array.from(toolSet).sort(), skillIds: Array.from(skillSet).sort() };
}

export function partitionToolsByCapability(
    graphTools: string[],
    enabledToolSet: Set<string>
): { effective: string[]; blocked: string[] } {
    const effective: string[] = [];
    const blocked: string[] = [];
    for (const t of graphTools) {
        if (enabledToolSet.has(t)) effective.push(t);
        else blocked.push(t);
    }
    return { effective, blocked };
}

function automationDocWorkspaceIdString(doc: { workspaceId?: unknown }): string | null {
    const w = doc.workspaceId;
    if (w == null) return null;
    if (typeof w === "object" && w !== null && "toString" in w) {
        return String((w as { toString(): string }).toString());
    }
    return String(w);
}

/**
 * Build execution-context DTO for an automation scoped to a workspace.
 * Returns null if the automation is not visible in that workspace or workspace is missing.
 */
export async function buildAutomationExecutionContext(
    automationId: string,
    workspaceId: string
): Promise<AutomationExecutionContextDTO | null> {
    const automation = await automationExecutor.getAutomation(automationId, workspaceId);
    if (!automation) return null;

    const workspace = await getWorkspaceByIdUnsafe(workspaceId);
    if (!workspace?._id) return null;

    const caps = await resolveWorkspaceCapabilities(workspaceId);
    const enabledSet = caps.enabledToolSet;

    const stages: AutomationExecutionContextStageDTO[] = [];
    const stageList = automation.stages ?? [];
    for (let i = 0; i < stageList.length; i++) {
        const stage = stageList[i];
        const graph = await agentGraphService.resolveGraphForStage(stage.graphId);
        const { tools, skillIds } = graph ? collectToolsAndSkillsFromGraph(graph) : { tools: [], skillIds: [] };
        const { effective, blocked } = partitionToolsByCapability(tools, enabledSet);

        stages.push({
            stageId: stage.id,
            stageName: stage.name,
            stageIndex: i,
            configuredGraphId: stage.graphId,
            resolvedGraphId: graph?._id ? graph._id.toString() : null,
            resolvedGraphName: graph?.name ?? null,
            graphToolNamesRequested: tools.length,
            toolsEffectiveCount: effective.length,
            toolsBlockedTotal: blocked.length,
            toolsBlockedSample: blocked.slice(0, AUTOMATION_EXEC_CONTEXT_MAX_BLOCKED_TOOLS),
            pinnedSkillIds: skillIds,
        });
    }

    return {
        workspaceId,
        workspaceName: workspace.name,
        workspaceRootPath: workspace.rootPath,
        automationWorkspaceId: automationDocWorkspaceIdString(automation as { workspaceId?: unknown }),
        skillCount: caps.enabledSkills.length,
        integrationProviderIds: [...caps.enabledIntegrationProviderIds].sort(),
        externalMcpServerCount: caps.externalMcpServers.length,
        defaultWorkMode: "code",
        stages,
    };
}
