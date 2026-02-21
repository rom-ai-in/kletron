export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@numezis/server/services/businessAnalystService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/business-analyst/dashboard
 * Get dashboard summary for the current workspace
 */
export async function GET(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const summary = await businessAnalystService.getDashboardSummary(
            workspace._id.toString()
        );
        return NextResponse.json({ summary }, { status: 200 });
    } catch (error) {
        console.error("[API /api/business-analyst/dashboard GET] Error:", error);
        return NextResponse.json({
            summary: {
                totalFeatures: 0,
                byType: {},
                byStatus: {},
                byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
                topPriorityFeatures: [],
            },
        }, { status: 200 });
    }
}
