import { ReActEngine } from "@numezis/server/services/agent/ReActEngine";
import type { AgentEvent } from "@numezis/shared/types";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function POST(request: Request, context: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = context.params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Conversation ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = (payload as any).message;
  const llmProvider = (payload as any).llmProvider;
  const graphId = (payload as any).graphId;

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const engine = ReActEngine.getInstance();
  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, payload as any);
  if (!workspace || !workspace._id) {
    return new Response(JSON.stringify({ error: "Workspace not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const llmSelection = llmProvider
    ? { provider: llmProvider as "azure" | "lmstudio" | "openai" | "claude" | "gemini" | "ollama", model: undefined }
    : undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent | string) => {
        const payload = typeof event === "string" ? event : JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      try {
        await runWithWorkspaceContext(workspace, async () => {
          await engine.chat(
            id,
            message,
            (event: AgentEvent) => {
              send(event);
            },
            llmSelection,
            typeof graphId === "string" ? graphId : undefined
          );
        });
        send("[DONE]");
        controller.close();
      } catch (error: any) {
        console.error("Chat error:", error);
        send(JSON.stringify({ error: error?.message || "Chat failed" }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
