export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * GET /api/activity
 * Merges workbench sessions (audit_sessions) and campaign runs (audit_runs)
 * into a single chronological feed.
 */
export async function GET(req: NextRequest) {
    try {
        const db = await getDb();
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "50");

        // 1. Fetch workbench sessions
        const sessions = await db.collection("audit_sessions")
            .find({})
            .project({
                _id: 1,
                prompt: 1,
                status: 1,
                startedAt: 1,
                endedAt: 1,
                "workflowResult.conclusion": 1,
            })
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();

        // 2. Fetch campaign runs
        const runs = await db.collection("audit_runs")
            .find({})
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();

        // 3. Map to a unified format
        const unifiedActivity: any[] = [
            ...sessions.map((s) => ({
                id: s._id.toString(),
                type: "WORKBENCH",
                title: s.prompt || "Ad-hoc Session",
                status: s.status,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                conclusion: s.workflowResult?.conclusion,
                link: `/`, // workbench runs are currently just in the main page, but we could add a detail view
            })),
            ...await Promise.all(runs.map(async (r) => {
                const chain = await chainExecutor.getChain(r.chainId.toString());
                return {
                    id: r._id.toString(),
                    type: "CAMPAIGN",
                    title: chain?.name || "Unknown Campaign",
                    status: r.status,
                    startedAt: r.startedAt,
                    endedAt: r.endedAt,
                    metadata: r.metadata,
                    link: `/runs/${r._id}`,
                };
            }))
        ];

        // 4. Sort and limit again across both sources
        unifiedActivity.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        const finalActivity = unifiedActivity.slice(0, limit);

        return NextResponse.json({ activity: finalActivity }, { status: 200 });
    } catch (error) {
        console.error("[API /api/activity GET] Error:", error);
        return NextResponse.json(
            { error: "Failed to list activity history" },
            { status: 500 }
        );
    }
}
