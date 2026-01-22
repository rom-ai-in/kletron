export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getIndexStatus } from "@/src/services/indexerService";
import { getSchedulerStatus } from "@/src/services/autoIndexScheduler";

export async function GET() {
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
