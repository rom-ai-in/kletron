export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { refreshIndexStatus } from "@numezis/server/services/indexerService";
import { getSchedulerStatus } from "@numezis/server/services/autoIndexScheduler";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function GET(request: Request) {
    const startTime = Date.now();
    let status = 200;
    let workspaceId: string | null = null;

    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            status = 401;
            return new Response(JSON.stringify({"error": "Unauthorized"}), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
        if (!workspace || !workspace._id) {
            status = 400;
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }
        workspaceId = workspace._id.toString();
        const indexStatus = await refreshIndexStatus(workspaceId, workspace.rootPath);
        const scheduler = getSchedulerStatus(workspaceId);

        return NextResponse.json({
            ...indexStatus,
            autoIndexEnabled: !process.env.DISABLE_AUTO_INDEX,
            lastAutoIndex: scheduler.lastRun?.toISOString() ?? null,
            nextAutoIndex: scheduler.lastRun
                ? new Date(scheduler.lastRun.getTime() + scheduler.intervalMs).toISOString()
                : null,
            schedulerStatus: scheduler.isRunning ? 'running' : scheduler.pendingRun ? 'pending' : 'idle',
            schedulerInterval: scheduler.intervalMs
        });
    } catch (error) {
        status = 500;
        return NextResponse.json(
            { error: "Failed to get index status" },
            { status: 500 }
        );
    } finally {
        const duration = Date.now() - startTime;
        console.info(`[api/vectors] GET ${status} ${duration}ms${workspaceId ? ` workspace=${workspaceId}` : ""}`);
    }
}
