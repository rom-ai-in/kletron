import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * POST /api/automations/[id]/cancel
 * Cancel the latest execution run for an automation (best-effort: takes effect between stages)
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
    const automationId = params.id;

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    if (!workspace || !workspace._id) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }

    const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());
    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const latestRun = await automationExecutor.getLatestRun(automationId, workspace._id.toString());
    if (!latestRun) {
      return NextResponse.json({ error: "No run found to cancel" }, { status: 404 });
    }

    if (latestRun.status === "COMPLETED" || latestRun.status === "FAILED" || latestRun.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Latest run is not cancellable (status: ${latestRun.status})` },
        { status: 400 }
      );
    }

    await automationExecutor.cancelRun(latestRun._id!.toString());
    return NextResponse.json({ status: "CANCELLED", runId: latestRun._id!.toString() }, { status: 200 });
  } catch (error) {
    console.error(`[API /api/automations/${params.id}/cancel POST] Error:`, error);
    return NextResponse.json({ error: "Failed to cancel automation run" }, { status: 500 });
  }
}
