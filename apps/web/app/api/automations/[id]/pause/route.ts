import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * POST /api/automations/[id]/pause
 * Pause a running automation
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

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null, { requireExplicitWorkspace: true });
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());

        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        if (automation.status !== "RUNNING") {
            return NextResponse.json(
                { error: "Automation is not running" },
                { status: 400 }
            );
        }

        await automationExecutor.pauseAutomation(automationId, workspace._id.toString());

        return NextResponse.json({ status: "PAUSED" }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/automations/${params.id}/pause POST] Error:`, error);
        return NextResponse.json(
            { error: "Failed to pause automation" },
            { status: 500 }
        );
    }
}
