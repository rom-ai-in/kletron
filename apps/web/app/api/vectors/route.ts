export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { refreshIndexStatus } from "@kletron/server/services/indexerService";
import { getSchedulerStatus } from "@kletron/server/services/autoIndexScheduler";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

/**
 * GET /api/vectors — Lightweight index status endpoint.
 *
 * Returns fast DB-only stats (indexed file count, chunk count, dimensions)
 * plus cached disk file count. No per-file hash comparison — that work
 * only happens during actual indexing operations.
 *
 * Errors are capped to the last 50 entries to keep the payload small
 * during polling; the full error list is available via errorCount.
 */
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

        const workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, null);
        if (!workspace || !workspace._id) {
            status = 400;
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }
        workspaceId = workspace._id.toString();
        const indexStatus = await refreshIndexStatus(workspaceId, workspace.rootPath);
        const scheduler = getSchedulerStatus(workspaceId);

        // Cap errors to keep polling payload small
        const MAX_ERRORS_IN_RESPONSE = 50;
        const cappedErrors = indexStatus.errors.slice(-MAX_ERRORS_IN_RESPONSE);

        return NextResponse.json({
            ...indexStatus,
            errors: cappedErrors,
            autoIndexEnabled: !process.env.DISABLE_AUTO_INDEX,
            lastAutoIndex: scheduler.lastRun?.toISOString() ?? null,
            nextAutoIndex: scheduler.lastRun
                ? new Date(scheduler.lastRun.getTime() + scheduler.intervalMs).toISOString()
                : null,
            schedulerStatus: scheduler.isRunning ? 'running' : scheduler.pendingRun ? 'pending' : 'idle',
            schedulerInterval: scheduler.intervalMs
        });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            status = workspaceError.status;
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
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
