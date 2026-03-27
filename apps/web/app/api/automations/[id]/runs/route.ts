import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * GET /api/automations/[id]/runs
 * List all execution runs for a specific automation
 */
export async function GET(
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
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null, { requireExplicitWorkspace: true });
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());
        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        const runs = await automationExecutor.listRuns(automationId, workspace._id.toString());

        return NextResponse.json({ runs }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/automations/${params.id}/runs GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to list automation runs" },
            { status: 500 }
        );
    }
}
