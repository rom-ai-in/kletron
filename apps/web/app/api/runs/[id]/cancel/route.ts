import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * POST /api/runs/[id]/cancel
 * Cancel a specific execution run (best-effort: takes effect between stages)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const runId = params.id;

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    if (!workspace || !workspace._id) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }

    const run = await automationExecutor.getRun(runId, workspace._id.toString());
    if (!run) {
      return NextResponse.json({ error: "Execution run not found" }, { status: 404 });
    }

    if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Run is not cancellable (status: ${run.status})` },
        { status: 400 }
      );
    }

    await automationExecutor.cancelRun(runId);
    return NextResponse.json({ status: "CANCELLED", runId }, { status: 200 });
  } catch (error) {
    console.error(`[API /api/runs/${params.id}/cancel POST] Error:`, error);
    return NextResponse.json({ error: "Failed to cancel run" }, { status: 500 });
  }
}
