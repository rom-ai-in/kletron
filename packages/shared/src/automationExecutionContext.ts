/**
 * API/UI DTO: effective execution context for an automation in a workspace.
 * Built server-side from workspace capabilities + resolved agent graphs per stage.
 */

export interface AutomationExecutionContextStageDTO {
    stageId: string;
    stageName: string;
    stageIndex: number;
    /** graphId stored on the automation stage */
    configuredGraphId: string;
    resolvedGraphId: string | null;
    resolvedGraphName: string | null;
    /** Distinct tool names referenced by the graph's ReAct nodes */
    graphToolNamesRequested: number;
    /** Tools both requested by the graph and allowed by workspace capabilities */
    toolsEffectiveCount: number;
    /** Tools requested by the graph but not in workspace capabilities */
    toolsBlockedTotal: number;
    /** First chunk of blocked tool names (capped server-side for payload size) */
    toolsBlockedSample: string[];
    /** Pinned skill ids from graph ReAct nodes */
    pinnedSkillIds: string[];
}

export interface AutomationExecutionContextDTO {
    workspaceId: string;
    workspaceName: string;
    workspaceRootPath: string;
    /** workspaceId persisted on the automation document, if any */
    automationWorkspaceId: string | null;
    skillCount: number;
    integrationProviderIds: string[];
    externalMcpServerCount: number;
    /** Automation threads are created without workMode; executor defaults to code */
    defaultWorkMode: "code";
    stages: AutomationExecutionContextStageDTO[];
}
