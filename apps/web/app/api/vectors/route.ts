export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { refreshIndexStatus } from "@numezis/server/services/indexerService";
import { getSchedulerStatus } from "@numezis/server/services/autoIndexScheduler";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }
        const workspaceId = workspace._id.toString();
        const status = await refreshIndexStatus(workspaceId, workspace.rootPath);
        const scheduler = getSchedulerStatus(workspaceId);

        return NextResponse.json({
            ...status,
            autoIndexEnabled: !process.env.DISABLE_AUTO_INDEX,
            lastAutoIndex: scheduler.lastRun?.toISOString() ?? null,
            nextAutoIndex: scheduler.lastRun
                ? new Date(scheduler.lastRun.getTime() + scheduler.intervalMs).toISOString()
                : null,
            schedulerStatus: scheduler.isRunning ? 'running' : scheduler.pendingRun ? 'pending' : 'idle',
            schedulerInterval: scheduler.intervalMs
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to get index status" },
            { status: 500 }
        );
    }
}
