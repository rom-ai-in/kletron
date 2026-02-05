export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/agent-graph-runs?graphId=...&limit=...
 * List recent runs for a given graph.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = req.nextUrl;
  const graphId = searchParams.get("graphId");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(50, Number(limitParam))) : 10;

  if (!graphId) {
    return NextResponse.json({ error: "Missing graphId" }, { status: 400 });
  }

  try {
    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    const workspaceId = workspace?._id?.toString();
    const runs = await agentGraphRunService.listRuns(graphId, limit, workspaceId);

    const serialized = runs.map((run) => ({
      id: run._id?.toString?.() ?? "",
      graphId: run.graphId?.toString?.() ?? graphId,
      status: run.status,
      startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : null,
      endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
    }));

    return NextResponse.json({ runs: serialized }, { status: 200 });
  } catch (error) {
    console.error("[API /api/agent-graph-runs GET] Error:", error);
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}
