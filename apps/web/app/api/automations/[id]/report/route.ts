import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

/**
 * GET /api/automations/[id]/report
 * Get aggregated report for a completed automation
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

        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());
        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        const latestRun = await automationExecutor.getLatestRun(automationId, workspace._id.toString());
        if (!latestRun) {
            return NextResponse.json({ error: "No runs found for this automation" }, { status: 404 });
        }

        if (latestRun.status !== "COMPLETED" && latestRun.status !== "FAILED") {
            return NextResponse.json(
                { error: "Automation has not completed yet" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                report: latestRun.finalReport || "",
                findings: latestRun.aggregatedFindings,
                insights: latestRun.crossStageInsights,
                metadata: latestRun.metadata,
                runId: latestRun._id?.toString(),
            },
            { status: 200 }
        );
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error(`[API /api/automations/${params.id}/report GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get report" },
            { status: 500 }
        );
    }
}

