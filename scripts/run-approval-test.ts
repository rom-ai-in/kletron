import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { buildInitialState, getGraphNodeOrder } from "@kletron/server/services/agentGraphRuntime";
import { listAllWorkspaces } from "@kletron/server/services/workspaceService";
import { SafeEditGate } from "@kletron/server/services/agent/SafeEditGate";
import { POST as approvalsPost } from "../apps/web/app/api/agent-graph-runs/[runId]/approvals/route";

async function main() {
  process.env.KLETRON_AUTH_BYPASS = "true";

  const graphs = await agentGraphService.listGraphs({ search: "Simple ReAct" });
  const graph = graphs.find((g) => g.name === "Simple ReAct (agent graph)") ?? graphs[0];
  if (!graph?._id) {
    throw new Error("No graph found to run");
  }

  const workspaces = await listAllWorkspaces();
  const workspace = workspaces[0];
  if (!workspace?._id) {
    throw new Error("No workspace available for run");
  }

  const nodeOrder = getGraphNodeOrder(graph);
  const runId = await agentGraphRunService.createRun(String(graph._id), String(workspace._id));
  const initialStatuses: Record<string, any> = {};
  for (const node of graph.nodes) initialStatuses[node.id] = "PENDING";
  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialStatuses,
    state: buildInitialState(graph as any, "Approval test run"),
  } as any);

  const gate = SafeEditGate.getInstance();
  const edit = gate.proposeEdit(
    runId,
    "write_file",
    { filePath: "approval_test.txt", content: "approval test" },
    "Write approval_test.txt",
    workspace._id?.toString()
  );
  const pending = gate.listPendingEdits(runId);
  console.log(JSON.stringify({ runId, pendingCount: pending.length, pending }, null, 2));

  if (pending.length === 0) {
    console.log("No pending approvals found. The model may not have called write_file.");
    return;
  }

  const req = new Request(`http://localhost/api/agent-graph-runs/${runId}/approvals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost",
    },
    body: JSON.stringify({ action: "approve", id: edit.id }),
  });

  const res = await approvalsPost(req as any, { params: { runId } } as any);
  const json = await res.json();
  console.log(JSON.stringify({ approvalResult: json }, null, 2));
}

main().catch((err) => {
  console.error("Approval test failed:", err);
  process.exitCode = 1;
});
