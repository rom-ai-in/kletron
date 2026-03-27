export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * GET /api/agent-graph-runs/[runId]
 * Fetch a single run record (status, nodeStatuses, state, session ids).
 */
export async function GET(req: NextRequest, { params }: { params: { runId: string } }) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const run = await agentGraphRunService.getRun(params.runId);
        if (!run) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }
        const runWorkspaceId = run.workspaceId?.toString?.();
        if (!runWorkspaceId || runWorkspaceId !== workspace._id.toString()) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }
        return NextResponse.json({ run }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/agent-graph-runs/${params.runId} GET] Error:`, error);
        return NextResponse.json({ error: "Failed to get run" }, { status: 500 });
    }
}
