export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getIndexStatus } from "@/src/services/indexerService";
import { getSchedulerStatus } from "@/src/services/autoIndexScheduler";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const status = getIndexStatus();
        const scheduler = getSchedulerStatus();

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
