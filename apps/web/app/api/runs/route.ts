export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { getDb } from "@numezis/server/lib/db";
import { ObjectId } from "mongodb";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/runs
 * List all execution runs across all campaigns
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
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        const workspaceId = workspace?._id?.toString();
        if (!workspaceId) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const db = await getDb();
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "50");
        const campaignId = searchParams.get("campaignId") || undefined;

        // Fetch all runs, sorted by start date
        const runsQuery: any = {};
        if (campaignId) {
            try {
                runsQuery.chainId = new ObjectId(campaignId);
            } catch {
                return NextResponse.json({ error: "Invalid campaignId" }, { status: 400 });
            }
            const chain = await chainExecutor.getChain(campaignId, workspaceId);
            if (!chain) {
                return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
            }
        }
        runsQuery.workspaceId = new ObjectId(workspaceId);
        const runs = await db.collection("audit_runs")
            .find(runsQuery)
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();

        // Optionally, we could join with campaign names here to make the UI simpler
        const enrichedRuns = await Promise.all(runs.map(async (run) => {
            const chain = await chainExecutor.getChain(run.chainId.toString(), workspaceId);
            return {
                ...run,
                chainName: chain?.name || "Unknown Campaign"
            };
        }));

        return NextResponse.json({ runs: enrichedRuns }, { status: 200 });
    } catch (error) {
        console.error("[API /api/runs GET] Error (returning empty list):", error);
        // Fallback to empty list so UI doesn't break if DB is unreachable
        return NextResponse.json({ runs: [] }, { status: 200 });
    }
}
