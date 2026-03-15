export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { getDb } from "@numezis/server/lib/db";
import { ObjectId } from "mongodb";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@numezis/server/services/workspaceService";

/**
 * GET /api/runs
 * List all execution runs across all automations
 */
export async function GET(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null, { requireExplicitWorkspace: true });
        const workspaceId = workspace?._id?.toString();
        if (!workspaceId) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const db = await getDb();
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "50");
        const automationId = searchParams.get("automationId") || undefined;

        // Fetch all runs, sorted by start date
        const runsQuery: any = {};
        if (automationId) {
            try {
                runsQuery.chainId = new ObjectId(automationId);
            } catch {
                return NextResponse.json({ error: "Invalid automationId" }, { status: 400 });
            }
            const automation = await automationExecutor.getAutomation(automationId, workspaceId);
            if (!automation) {
                return NextResponse.json({ error: "Automation not found" }, { status: 404 });
            }
        }
        runsQuery.workspaceId = new ObjectId(workspaceId);
        const runs = await db.collection("audit_runs")
            .find(runsQuery)
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();

        // Optionally, we could join with automation names here to make the UI simpler
        const enrichedRuns = await Promise.all(runs.map(async (run) => {
            const automation = await automationExecutor.getAutomation(run.chainId.toString(), workspaceId);
            return {
                ...run,
                automationName: automation?.name || "Unknown Automation"
            };
        }));

        return NextResponse.json({ runs: enrichedRuns }, { status: 200 });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error("[API /api/runs GET] Error (returning empty list):", error);
        // Fallback to empty list so UI doesn't break if DB is unreachable
        return NextResponse.json({ runs: [] }, { status: 200 });
    }
}
