export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { resolveLlmSelection } from "@numezis/server/llm";
import type { AgentWorkflowResult, AgentWorkflowUpdate } from "@numezis/shared/types";
import { agentGraphService } from "@numezis/server/services/agentGraphService";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { getGraphNodeOrder, buildInitialState } from "@numezis/server/services/agentGraphRuntime";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

const textEncoder = new TextEncoder();

type StreamChunk =
  | { type: "init"; payload: { runId: string; graphId: string } }
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "text_delta"; payload: { content: string } }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

/**
 * POST /api/sessions - Create a new session (run) and stream execution via NDJSON.
 * Body: { graphId: string, message: string, provider?: string, model?: string }
 */
export async function POST(request: Request) {
  console.log(`[sessions/create] ▶ POST /api/sessions`);

  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    console.log(`[sessions/create] ✗ Unauthorized`);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const graphId = typeof payload?.graphId === "string" ? payload.graphId.trim() : "";
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const provider = typeof payload?.provider === "string" ? payload.provider.trim() : undefined;
  const model = typeof payload?.model === "string" ? payload.model.trim() : undefined;
  const llmSelection = provider ? resolveLlmSelection({ provider, model }) : undefined;

  console.log(`[sessions/create] graphId="${graphId}", message="${message.slice(0, 40)}", provider=${provider}, model=${model}`);

  if (!message) {
    console.log(`[sessions/create] ✗ Missing message`);
    return new Response(JSON.stringify({ error: "Please provide a message." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!graphId) {
    console.log(`[sessions/create] ✗ Missing graphId`);
    return new Response(JSON.stringify({ error: "Please provide a graphId." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let graph = await agentGraphService.getGraph(graphId);
  if (!graph) {
    // Requested graph was deleted — fall back to first available graph
    const allGraphs = await agentGraphService.listGraphs();
    graph = allGraphs[0] ?? null;
    if (!graph) {
      return new Response(JSON.stringify({ error: "No agent graphs available. Please seed graphs first." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, payload as any);
  if (!workspace || !workspace._id) {
    return new Response(JSON.stringify({ error: "Workspace not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create run record
  const nodeOrder = getGraphNodeOrder(graph as any);
  console.log(`[sessions/create] Creating run for graph "${graph.name}" (${graphId}), workspace=${workspace._id}`);
  const runId = await agentGraphRunService.createRun(graphId, workspace._id.toString());
  console.log(`[sessions/create] ✓ Run created: ${runId}`);
  const initialNodeStatuses: Record<string, any> = {};
  for (const node of graph.nodes) {
    initialNodeStatuses[node.id] = "PENDING";
  }
  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialNodeStatuses,
    state: buildInitialState(graph as any, message),
    title: (message.startsWith("[System:") && message.indexOf("]\n\n") !== -1
      ? message.slice(message.indexOf("]\n\n") + 3)
      : message
    ).trim().slice(0, 80),
    conversationTurns: 1,
  } as any);
  console.log(`[sessions/create] ✓ Run status set to RUNNING`);

  // Track client disconnect via the request abort signal
  let clientDisconnected = false;
  request.signal?.addEventListener("abort", () => {
    clientDisconnected = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (chunk: StreamChunk) => {
        if (clientDisconnected) return; // client gone, skip writing
        try {
          controller.enqueue(textEncoder.encode(`${JSON.stringify(chunk)}\n`));
        } catch {
          clientDisconnected = true;
        }
      };
      sendChunk({ type: "init", payload: { runId, graphId } });
      console.log(`[sessions/create] Stream started for run ${runId}`);

      try {
        const { agentGraphExecutor } = await import("@numezis/server/services/agentGraphExecutor");
        console.log(`[sessions/create] Calling executeRunStreaming for ${runId}...`);
        const result = await agentGraphExecutor.executeRunStreaming(runId, {
          onUpdate: async (update) => {
            sendChunk({ type: "update", payload: update });
          },
          onTextDelta: (content) => {
            sendChunk({ type: "text_delta", payload: { content } });
          },
          ...(llmSelection ? { llmSelectionOverride: llmSelection } : {}),
        });
        console.log(`[sessions/create] ✓ executeRunStreaming completed for ${runId}`);
        sendChunk({ type: "final", payload: result });
      } catch (error: unknown) {
        console.error(`[sessions/create] ✗ executeRunStreaming error for ${runId}:`, (error as Error)?.message);
        sendChunk({
          type: "error",
          payload: { message: (error as Error)?.message ?? "Internal agent failure." },
        });
        // If the executor threw (not just a stream write failure), ensure FAILED status
        if (!clientDisconnected) {
          await agentGraphRunService.updateRunStatus(runId, "FAILED", {
            endedAt: new Date(),
            error: (error as Error)?.message ?? "Internal failure",
          } as any).catch(() => {});
        }
      } finally {
        console.log(`[sessions/create] Stream ended for ${runId} (clientDisconnected=${clientDisconnected})`);
        // If client disconnected mid-stream but executor finished, ensure status is updated
        if (clientDisconnected) {
          const currentRun = await agentGraphRunService.getRun(runId);
          if (currentRun && currentRun.status === "RUNNING") {
            console.warn(`[sessions/create] Client disconnected, force-completing run ${runId}`);
            await agentGraphRunService.updateRunStatus(runId, "COMPLETED", {
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

/**
 * GET /api/sessions - List sessions (runs with title, status, timestamps).
 * Query params: ?workspaceId=, ?includeArchived=true, ?limit=50, ?graphId=
 */
export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? undefined;
  const includeArchived = searchParams.get("includeArchived") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const graphId = searchParams.get("graphId") ?? undefined;

  // If no workspaceId provided, resolve from request
  let resolvedWorkspaceId = workspaceId;
  if (!resolvedWorkspaceId) {
    const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
    resolvedWorkspaceId = workspace?._id?.toString();
  }

  try {
    const runs = await agentGraphRunService.listSessions(resolvedWorkspaceId, {
      includeArchived,
      limit,
      graphId,
    });

    // Helper: strip injected [System: ...] personality prefix from titles
    const cleanTitle = (raw?: string) => {
      if (!raw) return "Untitled";
      if (raw.startsWith("[System:") && raw.indexOf("]\n\n") !== -1) {
        return raw.slice(raw.indexOf("]\n\n") + 3).trim() || "Untitled";
      }
      return raw;
    };

    const sessions = runs.map((run) => ({
      id: run._id?.toString(),
      graphId: run.graphId?.toString(),
      title: cleanTitle(run.title ?? run.state?.mission?.slice(0, 80)),
      status: run.status,
      archived: run.archived ?? false,
      conversationTurns: run.conversationTurns ?? 1,
      startedAt: run.startedAt?.toISOString?.() ?? new Date().toISOString(),
      endedAt: run.endedAt?.toISOString?.() ?? null,
      tokenUsage: run.tokenUsage ?? null,
    }));

    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to list sessions" }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions - Bulk archive or delete sessions.
 * Body: { ids: string[], action?: "archive" | "delete" }
 */
export async function DELETE(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]).filter((id) => typeof id === "string") : [];
  const action = (body as any)?.action === "delete" ? "delete" : "archive";

  if (!ids.length) {
    return NextResponse.json({ error: "No session IDs provided" }, { status: 400 });
  }

  try {
    for (const id of ids) {
      if (action === "delete") {
        await agentGraphRunService.deleteRun(id);
      } else {
        await agentGraphRunService.archiveRun(id);
      }
    }
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to process sessions" }, { status: 500 });
  }
}
