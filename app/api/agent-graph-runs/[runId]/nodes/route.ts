export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { ObjectId } from "mongodb";

import { agentGraphRunService } from "@/src/services/agentGraphRunService";

/**
 * GET /api/agent-graph-runs/[runId]/nodes
 * Fetch node labels from sessions for a given run.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
    try {
        const { runId } = await params;
        const run = await agentGraphRunService.getRun(runId);
        if (!run) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }

        const db = await getDb();
        const nodeSessionIds = run.nodeSessionIds || {};
        const sessionIds = Object.values(nodeSessionIds).filter(Boolean);

        // Fetch sessions to extract labels from prompts
        const labelMap: Record<string, string> = {};

        if (sessionIds.length > 0) {
            const sessions = await db.collection("audit_sessions")
                .find({
                    _id: { $in: sessionIds.map(id => new ObjectId(id)) }
                })
                .project({ _id: 1, prompt: 1 })
                .toArray();

            // Parse labels from prompts: [AgentGraph] run=XXX node=YYY label="Label Name"
            for (const session of sessions) {
                const prompt = session.prompt || "";
                const labelMatch = prompt.match(/label="([^"]+)"/);
                const nodeMatch = prompt.match(/node=(\S+)/);

                if (nodeMatch && labelMatch) {
                    labelMap[nodeMatch[1]] = labelMatch[1];
                }
            }
        }

        // Also try to get labels from the graph definition
        if (run.graphId) {
            const graph = await db.collection("agent_graphs")
                .findOne({ _id: run.graphId });

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
