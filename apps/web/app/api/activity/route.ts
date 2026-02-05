export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@numezis/server/lib/db";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { ObjectId } from "mongodb";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

/**
 * GET /api/activity
 * Merges workbench sessions (audit_sessions), campaign runs (audit_runs),
 * and agent graph runs (agent_graph_runs) into a single chronological feed.
 */
export async function GET(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const db = await getDb();
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "50");
        const campaignId = searchParams.get("campaignId") || undefined;

        // 1. Fetch workbench sessions (excluding AgentGraph sessions)
        const sessions = await db.collection("audit_sessions")
            .find({ prompt: { $not: /^\[AgentGraph\]/ } })
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

        // 3. Fetch agent graph runs
        const graphRuns = await db.collection("agent_graph_runs")
            .find({})
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();

        // Fetch graph names for all unique graphIds
        const graphIds = [...new Set(graphRuns.map(r => r.graphId?.toString()).filter(Boolean))];
        const graphs = await db.collection("agent_graphs")
            .find({ _id: { $in: graphIds.map(id => new ObjectId(id)) } })
            .project({ _id: 1, name: 1 })
            .toArray();
        const graphNameMap = new Map(graphs.map(g => [g._id.toString(), g.name]));

        // 4. Map to a unified format
        const unifiedActivity: any[] = [
            ...sessions.map((s) => ({
                id: s._id.toString(),
                type: "WORKBENCH",
                title: s.prompt || "Ad-hoc Session",
                status: s.status,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                conclusion: s.workflowResult?.conclusion,
                link: `/deep-agent`,
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
            })),
            ...graphRuns.map((r) => {
                const graphName = graphNameMap.get(r.graphId?.toString()) || "Unknown Graph";
                const nodeCount = r.nodeOrder?.length || 0;
                const completedNodes = Object.values(r.nodeStatuses || {}).filter(s => s === "COMPLETED").length;
                const failedNodes = Object.values(r.nodeStatuses || {}).filter(s => s === "FAILED").length;
                // Extract token usage from run
                const tokenUsage = r.tokenUsage;
                const totalTokens = tokenUsage?.totalTokens || 0;
                return {
                    id: r._id.toString(),
                    type: "AGENT_GRAPH",
                    title: graphName,
                    status: r.status,
                    startedAt: r.startedAt,
                    endedAt: r.endedAt,
                    graphId: r.graphId?.toString(),
                    metadata: {
                        nodeCount,
                        completedNodes,
                        failedNodes,
                        nodeSessionIds: r.nodeSessionIds,
                        nodeStatuses: r.nodeStatuses,
                        nodeOrder: r.nodeOrder,
                        totalTokens,
                        tokenUsage,
                    },
                    link: `/agent-graph/${r.graphId}`,
                };
            })
        ];

        // 5. Sort and limit again across all sources
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
