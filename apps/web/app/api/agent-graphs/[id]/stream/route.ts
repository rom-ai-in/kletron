export const dynamic = "force-dynamic";
import { resolveLlmSelection } from "@kletron/server/llm";
import type { AgentWorkflowResult, AgentWorkflowUpdate } from "@kletron/shared/types";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { getGraphNodeOrder, buildInitialState } from "@kletron/server/services/agentGraphRuntime";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

const textEncoder = new TextEncoder();

type StreamChunk =
  | { type: "init"; payload: { runId: string; graphId: string } }
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ "error": "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const provider = typeof payload?.provider === "string" ? payload.provider.trim() : undefined;
  const model = typeof payload?.model === "string" ? payload.model.trim() : undefined;
  // If provider isn't explicitly chosen, let DB-configured defaults apply.
  const llmSelection = provider ? resolveLlmSelection({ provider, model }) : undefined;

  if (!message) {
    return new Response(JSON.stringify({ error: "Please provide a user message in the request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const graph = await agentGraphService.getGraph(params.id);
  if (!graph) {
    return new Response(JSON.stringify({ error: "Graph not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, payload as any);
  if (!workspace || !workspace._id) {
    return new Response(JSON.stringify({ error: "Workspace not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Prepare run record
  const nodeOrder = getGraphNodeOrder(graph as any);
  const runId = await agentGraphRunService.createRun(params.id, workspace._id.toString(), "agent");
  const initialNodeStatuses: Record<string, any> = {};
  for (const node of graph.nodes) {
    initialNodeStatuses[node.id] = "PENDING";
  }
  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialNodeStatuses,
    state: buildInitialState(graph as any, message),
  } as any);

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (chunk: StreamChunk) => {
        controller.enqueue(textEncoder.encode(`${JSON.stringify(chunk)}\n`));
      };

      // Send runId immediately so frontend can persist session
      sendChunk({ type: "init", payload: { runId, graphId: params.id } });

      try {
        const { agentGraphExecutor } = await import("@kletron/server/services/agentGraphExecutor");
        const result = await agentGraphExecutor.executeRunStreaming(runId, {
          onUpdate: async (update) => {
            sendChunk({ type: "update", payload: update });
          },
          ...(llmSelection ? { llmSelectionOverride: llmSelection } : {}),
        });
        sendChunk({ type: "final", payload: result });
      } catch (error: unknown) {
        sendChunk({
          type: "error",
          payload: { message: (error as Error)?.message ?? "Internal agent failure." },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
