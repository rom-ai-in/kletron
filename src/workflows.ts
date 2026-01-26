import { AgentWorkflowOptions, AgentWorkflowResult } from "./types";
import { agentGraphService } from "./services/agentGraphService";
import { agentGraphRunService } from "./services/agentGraphRunService";
import { topoSortAgentGraph } from "./services/agentGraphTopo";
import { agentGraphExecutor } from "./services/agentGraphExecutor";

export async function runWorkflow(
  message: string,
  graphId?: string,
  options?: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  // If no graphId is provided, try to find a default "Diamond flow" one in the DB
  let graphRecord;
  if (graphId && graphId !== "audit" && graphId !== "simple_react") {
    graphRecord = await agentGraphService.getGraph(graphId);
  }

  if (!graphRecord) {
    const graphs = await agentGraphService.listGraphs();
    // Prefer "Diamond flow (agent graph)" or similar
    graphRecord = graphs.find(g => g.name.toLowerCase().includes("diamond")) ?? graphs[0];
  }

  if (!graphRecord) {
    throw new Error("No graphs found in database. Create one first.");
  }

  // Prepare run record (similar logic to the API route)
  const nodeOrder = topoSortAgentGraph(graphRecord.nodes, graphRecord.edges);
  const runId = await agentGraphRunService.createRun(graphRecord._id!.toString());
  const initialNodeStatuses: Record<string, any> = {};
  for (const node of graphRecord.nodes) {
    initialNodeStatuses[node.id] = "PENDING";
  }
  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialNodeStatuses,
    state: { mission: message, nodes: {} },
  } as any);

  return agentGraphExecutor.executeRunStreaming(runId, {
    onUpdate: options?.onUpdate,
    llmSelectionOverride: options?.llmSelection,
  });
}

