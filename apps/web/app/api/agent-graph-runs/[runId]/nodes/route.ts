export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@numezis/server/lib/db";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/agent-graph-runs/[runId]/nodes
 * Fetch node labels from sessions for a given run.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { runId } = await params;
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }
        const run = await agentGraphRunService.getRun(runId);
        if (!run) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }
        const runWorkspaceId = run.workspaceId?.toString?.();
        if (!runWorkspaceId || runWorkspaceId !== workspace._id.toString()) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }

        const db = await getDb();
        const labelMap: Record<string, string> = {};

        // Also try to get labels from the graph definition
        if (run.graphId) {
            const graph = await db.collection("agent_graphs").findOne({ _id: run.graphId });

            if (graph?.nodes) {
                for (const node of graph.nodes) {
                    if (node.id && node.label && !labelMap[node.id]) {
                        labelMap[node.id] = node.label;
                    }
                }
            }
        }

        return NextResponse.json({ labelMap }, { status: 200 });
    } catch (error) {
        const { runId } = await params;
        console.error(`[API /api/agent-graph-runs/${runId}/nodes GET] Error:`, error);
        return NextResponse.json({ error: "Failed to get node labels" }, { status: 500 });
    }
}
