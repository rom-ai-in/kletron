export const dynamic = "force-dynamic";
import { resolveLlmSelection } from "@kletron/server/llm";
import type { AgentWorkflowResult, AgentWorkflowUpdate } from "@kletron/shared/types";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

const textEncoder = new TextEncoder();

type StreamChunk =
  | { type: "init"; payload: { runId: string; graphId: string } }
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "text_delta"; payload: { content: string } }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

/**
 * POST /api/sessions/[id]/chat - Continue a session with a follow-up message.
 * Streams NDJSON updates using the multi-turn continueRun method.
 * Body: { message: string, provider?: string, model?: string }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  console.log(`[sessions/chat] ▶ POST /api/sessions/${params.id}/chat`);

  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    console.log(`[sessions/chat] ✗ Unauthorized`);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const provider = typeof payload?.provider === "string" ? payload.provider.trim() : undefined;
  const model = typeof payload?.model === "string" ? payload.model.trim() : undefined;
  const llmSelection = provider ? resolveLlmSelection({ provider, model }) : undefined;

  console.log(`[sessions/chat] message="${message.slice(0, 40)}", provider=${provider}, model=${model}`);

  if (!message) {
    return new Response(JSON.stringify({ error: "Please provide a message." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const run = await agentGraphRunService.getRun(params.id);
  if (!run) {
    console.log(`[sessions/chat] ✗ Session not found: ${params.id}`);
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[sessions/chat] Run status="${run.status}", startedAt=${run.startedAt}, endedAt=${run.endedAt}, graphId=${run.graphId}`);

  // Allow continuing completed, failed, paused, or cancelled runs directly.
  // For any other status (RUNNING, PENDING): if they've been in that state for
  // > 30 seconds, consider them stale and force-complete them so the user can
  // continue the conversation.
  const STALE_RUN_MS = 30 * 1000; // 30 seconds (reduced from 2 min for better UX)
  const allowedStatuses = ["COMPLETED", "FAILED", "PAUSED", "CANCELLED"];

  if (!allowedStatuses.includes(run.status)) {
    const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : 0;
    const runAge = Date.now() - startedAt;
    console.log(`[sessions/chat] Non-allowed status "${run.status}", age=${Math.round(runAge / 1000)}s, stale threshold=${STALE_RUN_MS / 1000}s`);

    if (runAge > STALE_RUN_MS) {
      // Force-complete the stale run so the user can continue
      console.warn(`[sessions/chat] ⚠ Force-completing stale run ${params.id} (status="${run.status}", running for ${Math.round(runAge / 1000)}s)`);
      try {
        await agentGraphRunService.updateRunStatus(params.id, "COMPLETED", {
          endedAt: new Date(),
        } as any);
        console.log(`[sessions/chat] ✓ Force-completed run ${params.id}`);
      } catch (err) {
        console.error(`[sessions/chat] ✗ Failed to force-complete run ${params.id}:`, err);
        return new Response(JSON.stringify({ error: "Failed to recover stale session. Try creating a new one." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.log(`[sessions/chat] ✗ Returning 409 — session is actively running (age ${Math.round(runAge / 1000)}s < ${STALE_RUN_MS / 1000}s)`);
      return new Response(JSON.stringify({ error: "Session is still running. Wait for it to complete." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    console.log(`[sessions/chat] ✓ Status "${run.status}" is allowed, proceeding with continuation`);
  }

  const graphId = run.graphId?.toString();

  // Track client disconnect via the request abort signal
  let clientDisconnected = false;
  request.signal?.addEventListener("abort", () => {
    clientDisconnected = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (chunk: StreamChunk) => {
        if (clientDisconnected) return;
        try {
          controller.enqueue(textEncoder.encode(`${JSON.stringify(chunk)}\n`));
        } catch {
          clientDisconnected = true;
        }
      };
      sendChunk({ type: "init", payload: { runId: params.id, graphId } });
      console.log(`[sessions/chat] Stream started for run ${params.id}`);

      try {
        const { agentGraphExecutor } = await import("@kletron/server/services/agentGraphExecutor");
        console.log(`[sessions/chat] Calling continueRun for ${params.id}...`);
        const result = await agentGraphExecutor.continueRun(params.id, message, {
          onUpdate: async (update) => {
            sendChunk({ type: "update", payload: update });
          },
          onTextDelta: (content) => {
            sendChunk({ type: "text_delta", payload: { content } });
          },
          ...(llmSelection ? { llmSelectionOverride: llmSelection } : {}),
        });
        console.log(`[sessions/chat] ✓ continueRun completed for ${params.id}`);
        sendChunk({ type: "final", payload: result });
      } catch (error: unknown) {
        console.error(`[sessions/chat] ✗ continueRun error for ${params.id}:`, (error as Error)?.message);
        sendChunk({
          type: "error",
          payload: { message: (error as Error)?.message ?? "Internal agent failure." },
        });
        if (!clientDisconnected) {
          await agentGraphRunService.updateRunStatus(params.id, "FAILED", {
            endedAt: new Date(),
            error: (error as Error)?.message ?? "Internal failure",
          } as any).catch(() => {});
        }
      } finally {
        console.log(`[sessions/chat] Stream ended for ${params.id} (clientDisconnected=${clientDisconnected})`);
        if (clientDisconnected) {
          const currentRun = await agentGraphRunService.getRun(params.id);
          if (currentRun && currentRun.status === "RUNNING") {
            console.warn(`[sessions/chat] Client disconnected, force-completing run ${params.id}`);
            await agentGraphRunService.updateRunStatus(params.id, "COMPLETED", {
              endedAt: new Date(),
            } as any).catch(() => {});
          }
        }
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
