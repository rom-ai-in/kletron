import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

/**
 * PUT /api/automations/[id]/execute
 * Start automation execution (non-blocking)
 */
export async function PUT(
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

        if (automation.status === "RUNNING") {
            return NextResponse.json(
                { error: "Automation is already running" },
                { status: 400 }
            );
        }

        const promptIssues = automation.stages
            .map((stage, index) => {
                if (stage.prompt && stage.prompt.trim().length > 0) return null;
                return {
                    index,
                    stageId: stage.id,
                    stageName: stage.name,
                };
            })
            .filter(Boolean);

        if (promptIssues.length > 0) {
            return NextResponse.json(
                {
                    error: "Automation blocked: one or more stages are missing prompts",
                    details: promptIssues,
                },
                { status: 400 }
            );
        }

        // Create a run immediately so the UI can navigate to it deterministically.
        const runId = await automationExecutor.startNewRun(automationId, workspace._id.toString());

        // Execute run in background (don't await)
        runWithWorkspaceContext(workspace, () => {
            automationExecutor.executeRun(runId).catch((error) => {
                console.error(`[AutomationExecution] Run ${runId} (Automation ${automationId}) failed:`, error);
            });
        });

        return NextResponse.json({ status: "STARTED", runId }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/automations/${params.id}/execute PUT] Error:`, error);
        return NextResponse.json(
            { error: "Failed to start automation execution" },
            { status: 500 }
        );
    }
}
