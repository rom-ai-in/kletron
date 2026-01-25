import { AgentWorkflowResult, AgentWorkflowUpdate } from "../../../../src/agentRunner";
import { resolveLlmSelection } from "../../../../src/llm";
import { runWorkflow } from "../../../../src/workflows";
import { normalizeAuditContext, type AuditContext } from "../../../../src/shared/auditContext";

const textEncoder = new TextEncoder();

type StreamChunk =
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const graph = typeof payload?.graph === "string" ? payload.graph.trim() : undefined;
  const provider = typeof payload?.provider === "string" ? payload.provider.trim() : undefined;
  const model = typeof payload?.model === "string" ? payload.model.trim() : undefined;
  const auditContext = normalizeAuditContext(
    (payload as { auditContext?: AuditContext }).auditContext
  );
  // If provider isn't explicitly chosen, let DB-configured defaults apply.
  const llmSelection = provider ? resolveLlmSelection({ provider, model }) : undefined;

  if (!message) {
    return new Response(JSON.stringify({ error: "Please provide a user message in the request body." }), {
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
        const result = await runWorkflow(message, graph, {
          onUpdate: async (update) => {
            sendChunk({ type: "update", payload: update });
          },
          ...(llmSelection ? { llmSelection } : {}),
          auditContext,
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
