export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import {
  heuristicTitle,
  sanitizeAssistantVisibleContent,
  sanitizeTitle,
  stripSystemPrefix,
  stripThoughtContent,
  stripThoughtTagsForTranscript,
} from "@kletron/server/services/titleSanitizer";
import { containsMetaLeakage } from "@kletron/shared/contentSanitizer";
import { parseThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

/**
 * GET /api/sessions/[id] - Get session details with conversation history and graph info.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "120");
    const beforeIndexParam = searchParams.get("beforeIndex");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 120;

    const run = await agentGraphRunService.getRun(params.id);
    if (!run) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch graph info for node count (to determine adaptive UI)
    const graph = await agentGraphService.getGraph(run.graphId.toString());

    // Strip injected [System: ...] personality prefix from title
    const rawTitle = run.title ?? run.state?.mission?.slice(0, 80) ?? "";
    const strippedTitle = stripThoughtContent(stripSystemPrefix(rawTitle)).trim();
    const title = sanitizeTitle(strippedTitle) || heuristicTitle(strippedTitle || rawTitle) || "Untitled";

    const rawHistory = Array.isArray(run.state?.conversationHistory)
      ? run.state.conversationHistory
      : [];
    const sanitizedConversationHistory = rawHistory
      .map((event) => {
        const original = typeof event?.content === "string" ? event.content : "";
        const cleaned = sanitizeAssistantVisibleContent(stripThoughtTagsForTranscript(original)).trim();
        // Use shared containsMetaLeakage from contentSanitizer instead of inline regex
        if (
          !cleaned ||
          containsMetaLeakage(cleaned) ||
          /\brespond with only the title\b/i.test(cleaned) ||
          /\bwe need to produce a short chat title\b/i.test(cleaned)
        ) {
          return { ...event, content: "" };
        }
        return cleaned === original ? event : { ...event, content: cleaned };
      })
      .filter((event) => {
        const content = typeof event?.content === "string" ? event.content.trim() : "";
        if (event?.kind === "assistant" && !content) return false;
        if (event?.kind === "user" && !content) return false;
        return true;
      });

    const totalHistory = sanitizedConversationHistory.length;
    const parsedBeforeIndexRaw = beforeIndexParam == null ? null : Number(beforeIndexParam);
    const parsedBeforeIndex =
      parsedBeforeIndexRaw == null || !Number.isFinite(parsedBeforeIndexRaw)
        ? null
        : parsedBeforeIndexRaw;
    const endIndex = parsedBeforeIndex == null
      ? totalHistory
      : Math.min(Math.max(Math.trunc(parsedBeforeIndex), 0), totalHistory);
    const startIndex = Math.max(0, endIndex - limit);
    const paginatedConversationHistory = sanitizedConversationHistory.slice(startIndex, endIndex);
    const pagination = {
      total: totalHistory,
      start: startIndex,
      end: endIndex,
      limit,
      hasOlder: startIndex > 0,
      hasNewer: endIndex < totalHistory,
      nextBeforeIndex: startIndex > 0 ? startIndex : null,
    };

    const workMode = normalizeToWorkModeId(run.workMode as string | undefined);

    return NextResponse.json({
      id: run._id?.toString(),
      graphId: run.graphId?.toString(),
      workMode,
      title,
      status: run.status,
      archived: run.archived ?? false,
      threadApprovalMode: run.threadApprovalMode ?? "inherit",
      source: run.source ?? null,
      conversationTurns: run.conversationTurns ?? 1,
      startedAt: run.startedAt?.toISOString?.() ?? null,
      endedAt: run.endedAt?.toISOString?.() ?? null,
      nodeOrder: run.nodeOrder,
      nodeStatuses: run.nodeStatuses,
      tokenUsage: run.tokenUsage ?? null,
      nodeTokenUsage: run.nodeTokenUsage ?? null,
      state: run.state,
      conversationHistory: paginatedConversationHistory,
      conversationPagination: pagination,
      graph: graph ? {
        name: graph.name,
        description: graph.description,
        category: graph.category,
        nodeCount: graph.nodes.length,
        nodes: graph.nodes.map((n) => ({ id: n.id, label: n.label })),
      } : null,
      error: run.error,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to get session" }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions/[id] — Update session fields (e.g. threadApprovalMode).
 * Body: { threadApprovalMode?: "inherit" | "confirm_everything" | "full_auto_thread" }
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await agentGraphRunService.getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.threadApprovalMode === undefined) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const mode = parseThreadApprovalMode(body.threadApprovalMode);
  const runWs = run.workspaceId?.toString();
  const wsPayload: Record<string, unknown> = runWs ? { workspaceId: runWs } : {};
  let workspace;
  try {
    workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, wsPayload);
  } catch (error) {
    const workspaceError = workspaceErrorToHttp(error);
    if (workspaceError) {
      return NextResponse.json(workspaceError.body, { status: workspaceError.status });
    }
    throw error;
  }
  if (!workspace || (runWs && workspace._id?.toString() !== runWs)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await agentGraphRunService.patchRun(params.id, { threadApprovalMode: mode });
  return NextResponse.json({ threadApprovalMode: mode });
}

/**
 * DELETE /api/sessions/[id] - Archive or delete a session.
 * Query param: ?action=delete (default: archive)
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") === "delete" ? "delete" : "archive";

  try {
    if (action === "delete") {
      await agentGraphRunService.deleteRun(params.id);
    } else {
      await agentGraphRunService.archiveRun(params.id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to process session" }, { status: 500 });
  }
}
