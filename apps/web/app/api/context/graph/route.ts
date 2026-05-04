import { NextRequest, NextResponse } from "next/server";

import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { ContextRanker } from "@kletron/server/context/graph/ContextRanker";
import { getContextGraphStore } from "@kletron/server/context/graph/contextGraphRegistry";
import { getEditorStateManager } from "@kletron/server/context/graph/EditorStateManager";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
    if (!workspace || !workspace._id) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }

    const store = getContextGraphStore(workspace._id.toString(), workspace.rootPath);
    await store.load();

    return NextResponse.json({ nodes: store.getAllNodes() });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Failed to load context graph" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { prompt?: string; limit?: number };
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 15;

    if (!prompt.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    if (!workspace || !workspace._id) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }

    const workspaceId = workspace._id.toString();
    const store = getContextGraphStore(workspaceId, workspace.rootPath);
    await store.load();

    const totalNodes = store.getAllNodes().length;
    if (totalNodes === 0) {
      return NextResponse.json({
        message: "No context graph yet. Run a repo scan from Context configuration.",
        ranked: [],
        totalNodes: 0,
      });
    }

    const ranker = new ContextRanker(store);
    const editorState = getEditorStateManager(workspaceId).getCurrentState();
    const ranked = await ranker.rank({
      userPrompt: prompt,
      editorState,
      limit,
    });

    return NextResponse.json({ ranked, totalNodes });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Failed to rank context" },
      { status: 500 },
    );
  }
}
