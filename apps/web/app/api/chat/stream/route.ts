import { AgentWorkflowResult, AgentWorkflowUpdate } from "@numezis/shared/types";
import { resolveLlmSelection } from "@numezis/server/llm";
import { runWorkflow } from "@numezis/agent-core/workflows";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

const textEncoder = new TextEncoder();

type StreamChunk =
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const graph = typeof payload?.graph === "string" ? payload.graph.trim() : undefined;
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

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, payload as any);
  if (!workspace || !workspace._id) {
    return new Response(JSON.stringify({ error: "Workspace not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (chunk: StreamChunk) => {
        controller.enqueue(textEncoder.encode(`${JSON.stringify(chunk)}\n`));
      };

      try {
        await runWithWorkspaceContext(workspace, async () => {
          const result = await runWorkflow(message, graph, {
            onUpdate: async (update) => {
              sendChunk({ type: "update", payload: update });
            },
            workspaceId: workspace._id!.toString(),
            ...(llmSelection ? { llmSelection } : {}),
          });
          sendChunk({ type: "final", payload: result });
        });
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
