import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

/**
 * POST /api/automations/[id]/resume
 * Resume a paused automation
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

        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null);
        const workspaceId = workspace?._id?.toString();
        if (!workspace || !workspaceId) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspaceId);

        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        if (automation.status !== "PAUSED") {
            return NextResponse.json(
                { error: "Automation is not paused" },
                { status: 400 }
            );
        }

        // Resume automation in background
        runWithWorkspaceContext(workspace, () => {
            automationExecutor.resumeAutomation(automationId, workspaceId).catch((error) => {
                console.error(`[AutomationResume] Automation ${automationId} failed:`, error);
            });
        });

        return NextResponse.json({ status: "RUNNING" }, { status: 200 });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error(`[API /api/automations/${params.id}/resume POST] Error:`, error);
        return NextResponse.json(
            { error: "Failed to resume automation" },
            { status: 500 }
        );
    }
}
