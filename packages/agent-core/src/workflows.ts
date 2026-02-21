import type { AgentWorkflowOptions, AgentWorkflowResult } from "@numezis/shared/types";
import type { AgentGraphDefinition } from "@numezis/server/services/agentGraphTypes";
import { agentGraphService } from "@numezis/server/services/agentGraphService";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { getGraphNodeOrder, buildInitialState } from "@numezis/server/services/agentGraphRuntime";
import { agentGraphExecutor } from "@numezis/server/services/agentGraphExecutor";

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

export async function runWorkflow(
  message: string,
  graphId?: string,
  options?: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  let graphRecord;

  if (graphId && OBJECTID_RE.test(graphId)) {
    graphRecord = await agentGraphService.getGraph(graphId);
  }

  // Legacy string-based graphId (e.g. "audit", "simple_react") or no graphId:
  // always resolve to the simplest single-node ReAct graph so that automation
  // stages execute their prompt directly without heavy state-machine overhead.
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
    options?.source
  );
  const initialNodeStatuses: Record<string, any> = {};
  for (const node of graphRecord.nodes) {
    initialNodeStatuses[node.id] = "PENDING";
  }
  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialNodeStatuses,
    state: buildInitialState(graphRecord, message),
  } as any);

  return agentGraphExecutor.executeRunStreaming(runId, {
    onUpdate: options?.onUpdate,
    llmSelectionOverride: options?.llmSelection,
    shouldAbort: options?.shouldAbort,
  });
}
