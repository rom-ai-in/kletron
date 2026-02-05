import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/campaigns/[id]/report
 * Get aggregated report for a completed chain
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
        const chainId = params.id;

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const chain = await chainExecutor.getChain(chainId, workspace._id.toString());
        if (!chain) {
            return NextResponse.json({ error: "Chain not found" }, { status: 404 });
        }

        const latestRun = await chainExecutor.getLatestRun(chainId, workspace._id.toString());
        if (!latestRun) {
            return NextResponse.json({ error: "No runs found for this campaign" }, { status: 404 });
        }

        if (latestRun.status !== "COMPLETED" && latestRun.status !== "FAILED") {
            return NextResponse.json(
                { error: "Chain has not completed yet" },
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
        console.error(`[API /api/campaigns/${params.id}/report GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get report" },
            { status: 500 }
        );
    }
}
