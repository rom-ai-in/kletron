export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { resolveLlmSelection } from "@kletron/server/llm";
import type { AgentWorkflowResult, AgentWorkflowUpdate } from "@kletron/shared/types";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { getGraphNodeOrder, buildInitialState } from "@kletron/server/services/agentGraphRuntime";
import { preflightMissionForNewRun } from "@kletron/server/services/skillSlashPreflight";
import { resolveEffectiveToolApprovalConfigForUser } from "@kletron/server/services/effectiveToolApprovalService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { parseThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";
import { heuristicTitle, sanitizeTitle, stripSystemPrefix, stripThoughtContent } from "@kletron/server/services/titleSanitizer";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";
import { normalizeResearchDepth } from "@kletron/shared/researchDepth";
import { categoryService } from "@kletron/server/services/categoryService";
import { agentGraphExecutor } from "@kletron/server/services/agentGraphExecutor";
import { getWorkspaceContextConfig } from "@kletron/server/services/auditContextService";
import { resolveWorkspaceCapabilities } from "@kletron/server/services/workspaceCapabilityResolver";
import { workspaceChannelSettingsService } from "@kletron/server/services/workspaceChannelSettingsService";
import { resolveGraphSelectionForNewSession } from "@kletron/server/services/graphRoutingService";
import type { AgentStreamKpiV1, GraphSelectionMode } from "@kletron/shared/chatTypes";
import { CHANNEL_IDS, type ChannelId } from "@kletron/shared/channelTypes";

const textEncoder = new TextEncoder();

type StreamChunk =
  | { type: "init"; payload: { runId: string; graphId: string; route?: any } }
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "text_delta"; payload: { content: string } }
  | { type: "reasoning_delta"; payload: { content: string } }
  | { type: "stream_metrics"; payload: AgentStreamKpiV1 }
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
  const graphSelectionMode: GraphSelectionMode =
    payload?.graphSelectionMode === "auto" ? "auto" : "manual";
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const provider = typeof payload?.provider === "string" ? payload.provider.trim() : undefined;
  const model = typeof payload?.model === "string" ? payload.model.trim() : undefined;
  const channel =
    typeof payload?.channel === "string" && CHANNEL_IDS.includes(payload.channel as ChannelId)
      ? (payload.channel as ChannelId)
      : null;
  const llmSelection = provider ? resolveLlmSelection({ provider, model }) : undefined;

  console.log(`[sessions/create] graphId="${graphId}", mode=${graphSelectionMode}, message="${message.slice(0, 40)}", provider=${provider}, model=${model}`);

  if (!message) {
    console.log(`[sessions/create] ✗ Missing message`);
    return new Response(JSON.stringify({ error: "Please provide a message." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (graphSelectionMode === "manual" && !graphId) {
    console.log(`[sessions/create] ✗ Missing graphId`);
    return new Response(JSON.stringify({ error: "Please provide a graphId." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let graph: Awaited<ReturnType<typeof agentGraphService.resolveGraphForStage>>;
  let workspace: Awaited<ReturnType<typeof resolveWorkspaceFromRequestStrict>>;
  let effectiveApproval: Awaited<ReturnType<typeof resolveEffectiveToolApprovalConfigForUser>>;
  try {
    [workspace, effectiveApproval] = await Promise.all([
      resolveWorkspaceFromRequestStrict(request, auth.userId, payload as any),
      resolveEffectiveToolApprovalConfigForUser(auth.userId),
    ]);
  } catch (error) {
    const workspaceError = workspaceErrorToHttp(error);
    if (workspaceError) {
      return new Response(JSON.stringify(workspaceError.body), {
        status: workspaceError.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw error;
  }

  if (!workspace || !workspace._id) {
    return new Response(JSON.stringify({ error: "Workspace not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const resolvedThreadMode = parseThreadApprovalMode(
    payload.threadApprovalMode !== undefined && payload.threadApprovalMode !== null
      ? payload.threadApprovalMode
      : effectiveApproval.defaultThreadApprovalMode
  );

  let workMode = normalizeToWorkModeId(
    typeof payload.workMode === "string"
      ? payload.workMode
      : typeof payload.category === "string"
        ? payload.category
        : null,
  );
  if (
    payload.workMode === undefined &&
    payload.category === undefined &&
    auth.userId &&
    workspace._id
  ) {
    const stored = await categoryService.getCurrentCategory(auth.userId, workspace._id.toString());
    if (stored) workMode = normalizeToWorkModeId(stored);
  }

  if (
    auth.userId &&
    workspace._id &&
    (typeof payload.workMode === "string" || typeof payload.category === "string")
  ) {
    await categoryService.setCurrentCategory(auth.userId, workMode, workspace._id.toString());
  }

  const workspaceId = workspace._id.toString();
  const [contextConfig, workspaceCaps, channelSettings] = await Promise.all([
    getWorkspaceContextConfig(workspaceId),
    resolveWorkspaceCapabilities(workspaceId),
    channel ? workspaceChannelSettingsService.get(workspaceId, channel) : Promise.resolve(null),
  ]);

  const selection = await resolveGraphSelectionForNewSession({
    graphSelectionMode,
    message,
    workMode,
    requestedGraphId: graphId || undefined,
    channelDefaultGraphId: channelSettings?.defaultGraphId || undefined,
    documentContext: contextConfig?.enabled ? contextConfig.context : null,
    activeConnectorProviderIds: workspaceCaps.enabledIntegrationProviderIds,
    listGraphs: () => agentGraphService.listGraphs(),
    resolveGraphById: (nextGraphId) => agentGraphService.resolveGraphForStage(nextGraphId),
  });
  graph = selection.graph;

  if (!graph?._id) {
    return new Response(JSON.stringify({ error: "No agent graphs available. Please seed graphs first." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const resolvedGraphId = String(graph._id);
  const resolvedRoute = {
    ...selection.route,
    resolvedGraphId,
    resolvedGraphName: graph.name,
  };

  // Create run record (always persist Mongo graph id — client may send legacy slug, not ObjectId)
  const nodeOrder = getGraphNodeOrder(graph as any);
  console.log(
    `[sessions/create] Creating run for graph "${graph.name}" (requested=${graphId}, resolved=${resolvedGraphId}, route=${resolvedRoute.source}), workspace=${workspace._id}`,
  );
  const researchDepth = normalizeResearchDepth(payload?.researchDepth);

  const [runId, pre] = await Promise.all([
    agentGraphRunService.createRun(resolvedGraphId, workspace._id.toString(), "agent", {
      threadApprovalMode: resolvedThreadMode,
      workMode,
      createdByUserId: auth.userId,
      researchDepth,
    }),
    preflightMissionForNewRun(message, workspace._id.toString()),
  ]);
  console.log(`[sessions/create] ✓ Run created: ${runId}`);
  const initialNodeStatuses: Record<string, any> = {};
  for (const node of graph.nodes) {
    initialNodeStatuses[node.id] = "PENDING";
  }
  const initialState = {
    ...buildInitialState(graph as any, pre.mission),
    mission: pre.mission,
    userInput: pre.mission,
    route: resolvedRoute,
    loadedSkillIds: pre.loadedSkillIds.length ? pre.loadedSkillIds : undefined,
    skillLoads: pre.skillLoads.length ? pre.skillLoads : undefined,
  };
  const titleSource =
    pre.mission.startsWith("[System:") && pre.mission.indexOf("]\n\n") !== -1
      ? pre.mission.slice(pre.mission.indexOf("]\n\n") + 3)
      : pre.mission;
  await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
    nodeOrder,
    nodeStatuses: initialNodeStatuses,
    state: initialState,
    title: titleSource.trim().slice(0, 80),
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
          const taggedChunk = { ...chunk, workspaceId: workspace._id?.toString() };
          controller.enqueue(textEncoder.encode(`${JSON.stringify(taggedChunk)}\n`));
        } catch {
          clientDisconnected = true;
        }
      };
      sendChunk({ type: "init", payload: { runId, graphId: resolvedGraphId, route: resolvedRoute } });
      console.log(`[sessions/create] Stream started for run ${runId}`);

      try {
        console.log(`[sessions/create] Calling executeRunStreaming for ${runId}...`);
        const result = await agentGraphExecutor.executeRunStreaming(runId, {
          onUpdate: async (update) => {
            sendChunk({ type: "update", payload: update });
          },
          onTextDelta: (content) => {
            sendChunk({ type: "text_delta", payload: { content } });
          },
          onReasoningDelta: (content) => {
            sendChunk({ type: "reasoning_delta", payload: { content } });
          },
          onLlmStreamKpi: (kpi) => {
            sendChunk({ type: "stream_metrics", payload: kpi });
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
          } as any).catch(() => { });
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
            } as any).catch(() => { });
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
 * Query params: ?workspaceId=, ?includeArchived=true, ?limit=50, ?graphId=, ?workMode=code|work
 */
export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? undefined;
  const allWorkspaces = searchParams.get("allWorkspaces") === "true";
  const includeArchived = searchParams.get("includeArchived") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const graphId = searchParams.get("graphId") ?? undefined;
  const excludeSource = searchParams.get("excludeSource") ?? undefined;
  const workModeRaw = searchParams.get("workMode");
  const listWorkModeFilter =
    workModeRaw != null && workModeRaw !== ""
      ? normalizeToWorkModeId(workModeRaw)
      : undefined;

  // If allWorkspaces=true, fetch sessions across all user workspaces
  // Otherwise resolve a single workspace to filter by
  let resolvedWorkspaceId = workspaceId;
  if (!allWorkspaces && !resolvedWorkspaceId) {
    try {
      const workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, null);
      resolvedWorkspaceId = workspace?._id?.toString();
    } catch (error) {
      const workspaceError = workspaceErrorToHttp(error);
      if (workspaceError) {
        return NextResponse.json(workspaceError.body, { status: workspaceError.status });
      }
      throw error;
    }
  }

  try {
    let runs;
    const listOpts = {
      includeArchived,
      limit,
      graphId,
      excludeSource,
      ...(listWorkModeFilter ? { workMode: listWorkModeFilter } : {}),
    };
    if (allWorkspaces) {
      runs = await agentGraphRunService.listSessions(undefined, listOpts);
    } else {
      runs = await agentGraphRunService.listSessions(resolvedWorkspaceId, listOpts);
    }

    // Helper: strip injected [System: ...] personality prefix from titles
    const cleanTitle = (raw?: string) => {
      if (!raw) return "Untitled";
      const stripped = stripSystemPrefix(raw);
      const noThoughts = stripThoughtContent(stripped).trim();
      const sanitized = sanitizeTitle(noThoughts);
      if (sanitized) {
        if (/\bwe need to\b|<think>|\bfinal answer\b/i.test(raw)) {
        }
        return sanitized;
      }
      const fallback = heuristicTitle(noThoughts || stripped);

      return fallback || "Untitled";
    };

    const sessions = runs.map((run) => ({
      id: run._id?.toString(),
      graphId: run.graphId?.toString(),
      workspaceId: run.workspaceId?.toString() ?? null,
      title: cleanTitle(run.title ?? run.state?.mission?.slice(0, 80)),
      status: run.status,
      archived: run.archived ?? false,
      conversationTurns: run.conversationTurns ?? 1,
      startedAt: run.startedAt?.toISOString?.() ?? new Date().toISOString(),
      endedAt: run.endedAt?.toISOString?.() ?? null,
      tokenUsage: run.tokenUsage ?? null,
      source: run.source ?? null,
      automationId: run.automationId?.toString() ?? null,
      workMode: normalizeToWorkModeId(run.workMode as string | undefined),
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

  // Resolve workspace to scope the operation
  let workspace;
  try {
    workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, body as any);
  } catch (error) {
    const workspaceError = workspaceErrorToHttp(error);
    if (workspaceError) {
      return NextResponse.json(workspaceError.body, { status: workspaceError.status });
    }
    throw error;
  }

  try {
    let processedCount = 0;
    for (const id of ids) {
      // Verify session belongs to the caller's workspace before acting
      const run = await agentGraphRunService.getRun(id);
      if (!run) continue;
      if (workspace?._id && run.workspaceId?.toString() !== workspace._id.toString()) {
        continue; // Skip sessions from other workspaces
      }

      if (action === "delete") {
        await agentGraphRunService.deleteRun(id);
      } else {
        await agentGraphRunService.archiveRun(id);
      }
      processedCount++;
    }
    return NextResponse.json({ success: true, count: processedCount });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to process sessions" }, { status: 500 });
  }
}
