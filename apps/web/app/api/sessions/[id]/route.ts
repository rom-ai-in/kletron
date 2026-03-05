export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { agentGraphService } from "@numezis/server/services/agentGraphService";
import { stripThoughtContent } from "@numezis/server/services/titleSanitizer";

/**
 * GET /api/sessions/[id] - Get session details with conversation history and graph info.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await agentGraphRunService.getRun(params.id);
    if (!run) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch graph info for node count (to determine adaptive UI)
    const graph = await agentGraphService.getGraph(run.graphId.toString());

    // Strip injected [System: ...] personality prefix from title
    let title = run.title ?? run.state?.mission?.slice(0, 80) ?? "Untitled";
    if (title.startsWith("[System:") && title.indexOf("]\n\n") !== -1) {
      title = title.slice(title.indexOf("]\n\n") + 3).trim() || "Untitled";
    }

    const rawHistory = Array.isArray(run.state?.conversationHistory)
      ? run.state.conversationHistory
      : [];
    const sanitizedConversationHistory = rawHistory
      .map((event) => {
        const original = typeof event?.content === "string" ? event.content : "";
        const cleaned = stripThoughtContent(original).trim();
        if (
          !cleaned ||
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

    return NextResponse.json({
      id: run._id?.toString(),
      graphId: run.graphId?.toString(),
      title,
      status: run.status,
      archived: run.archived ?? false,
      conversationTurns: run.conversationTurns ?? 1,
      startedAt: run.startedAt?.toISOString?.() ?? null,
      endedAt: run.endedAt?.toISOString?.() ?? null,
      nodeOrder: run.nodeOrder,
      nodeStatuses: run.nodeStatuses,
      tokenUsage: run.tokenUsage ?? null,
      nodeTokenUsage: run.nodeTokenUsage ?? null,
      state: run.state,
      conversationHistory: sanitizedConversationHistory,
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
