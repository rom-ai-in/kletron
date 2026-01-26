export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";
import { getDb } from "@/src/lib/db";
import { AuditRun } from "@/src/services/chainTypes";
import { ObjectId } from "mongodb";

/**
 * GET /api/runs
 * List all execution runs across all campaigns
 */
export async function GET(req: NextRequest) {
    try {
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
        }
        const runs = await db.collection("audit_runs")
            .find(runsQuery)
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();

        // Optionally, we could join with campaign names here to make the UI simpler
        const enrichedRuns = await Promise.all(runs.map(async (run) => {
            const chain = await chainExecutor.getChain(run.chainId.toString());
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
