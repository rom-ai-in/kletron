import type { AgentWorkflowOptions, AgentWorkflowResult } from "@kletron/shared/types";
import type { WorkCategoryConfig } from "@kletron/shared";
import type { AgentGraphDefinition } from "@kletron/server/services/agentGraphTypes";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { getGraphNodeOrder, buildInitialState } from "@kletron/server/services/agentGraphRuntime";
import { agentGraphExecutor } from "@kletron/server/services/agentGraphExecutor";
import { preflightMissionForNewRun } from "@kletron/server/services/skillSlashPreflight";

const OBJECTID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Pick the lightest single-node ReAct graph from a list.
 * Prefers graphs named "Simple ReAct", then any 1-node conversational graph.
 */
function findSimpleReactGraph(graphs: AgentGraphDefinition[]): AgentGraphDefinition | undefined {
  const isSingleConversational = (g: AgentGraphDefinition) =>
    g.nodes?.length === 1 && g.nodes[0]?.output?.schemaId === "conversational";

  return graphs.find(g =>
    isSingleConversational(g) && g.name.toLowerCase().includes("simple react")
  ) ?? graphs.find(g =>
    isSingleConversational(g)
  ) ?? graphs.find(g =>
    g.nodes?.length === 1
  );
}

export interface CategoryAwareWorkflowOptions extends AgentWorkflowOptions {
  category?: WorkCategoryConfig;
  /** Links the run to the automation config that triggered it. */
  automationId?: string;
  /** Marks this run as a hidden sub-stage of `parentRunId`. */
  parentRunId?: string;
  /** Stage index within the parent automation (0..N-1). */
  stageIndex?: number;
  /** Optional initial title for the run (used by automations to label sub-runs). */
  title?: string;
  /** Receives the runId immediately after it is created — useful for sub-stage tracking. */
  onRunCreated?: (runId: string) => void;
}

export async function runWorkflow(
  message: string,
  graphId?: string,
  options?: CategoryAwareWorkflowOptions
): Promise<AgentWorkflowResult> {
  let graphRecord;

  if (graphId) {
    if (!OBJECTID_RE.test(graphId)) {
      throw new Error(`Invalid graph id: ${graphId}`);
    }
    graphRecord = await agentGraphService.getGraph(graphId);
    if (!graphRecord) {
      throw new Error(`Graph ${graphId} not found.`);
    }
  }

  // Only callers that omit graphId entirely get the simple fallback graph.
  if (!graphRecord) {
    const graphs = await agentGraphService.listGraphs();
    graphRecord = findSimpleReactGraph(graphs) ?? graphs[0];
    console.info(
      `[runWorkflow] Resolved graphId="${graphId ?? "(none)"}" → "${graphRecord?.name}" (${graphRecord?.nodes?.length} nodes, id=${graphRecord?._id})`
    );
  }

  if (!graphRecord) {
    throw new Error("No graphs found in database. Create one first.");
  }

  // Prepare run record (similar logic to the API route)
  const nodeOrder = getGraphNodeOrder(graphRecord);
  const runId = await agentGraphRunService.createRun(
    graphRecord._id!.toString(),
    options?.workspaceId,
    options?.source,
    {
      automationId: options?.automationId,
      parentRunId: options?.parentRunId,
      stageIndex: options?.stageIndex,
      title: options?.title,
    }
  );
  options?.onRunCreated?.(runId);
  const initialNodeStatuses: Record<string, any> = {};
  for (const node of graphRecord.nodes) {
    initialNodeStatuses[node.id] = "PENDING";
  }
  const pre = options?.workspaceId
    ? await preflightMissionForNewRun(message, options.workspaceId)
    : null;
  const initialState = pre
    ? {
        ...buildInitialState(graphRecord, pre.mission),
        mission: pre.mission,
        userInput: pre.mission,
        loadedSkillIds: pre.loadedSkillIds.length ? pre.loadedSkillIds : undefined,
        skillLoads: pre.skillLoads.length ? pre.skillLoads : undefined,
      }
    : buildInitialState(graphRecord, message);

  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialNodeStatuses,
    state: initialState,
  } as any);

  return agentGraphExecutor.executeRunStreaming(runId, {
    onUpdate: options?.onUpdate,
    llmSelectionOverride: options?.llmSelection,
    shouldAbort: options?.shouldAbort,
  });
}
