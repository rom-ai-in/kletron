export const dynamic = "force-dynamic";
import { resolveLlmSelection } from "@/src/llm";
import type { AgentWorkflowResult, AgentWorkflowUpdate } from "@/src/agentRunner";
import { agentGraphService } from "@/src/services/agentGraphService";
import { agentGraphRunService } from "@/src/services/agentGraphRunService";
import { topoSortAgentGraph } from "@/src/services/agentGraphTopo";

const textEncoder = new TextEncoder();

type StreamChunk =
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  // Prepare run record
  const nodeOrder = topoSortAgentGraph(graph.nodes, graph.edges);
  const runId = await agentGraphRunService.createRun(params.id);
  const initialNodeStatuses: Record<string, any> = {};
  for (const node of graph.nodes) {
    initialNodeStatuses[node.id] = "PENDING";
  }
  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialNodeStatuses,
    state: { mission: message, nodes: {} },
  } as any);

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (chunk: StreamChunk) => {
        controller.enqueue(textEncoder.encode(`${JSON.stringify(chunk)}\n`));
      };

      try {
        const { agentGraphExecutor } = await import("@/src/services/agentGraphExecutor");
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

