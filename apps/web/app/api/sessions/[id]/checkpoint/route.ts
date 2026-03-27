export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import {
    getLatestCheckpoint,
    listCheckpoints,
} from "@kletron/server/services/checkpointService";

/**
 * GET /api/sessions/[id]/checkpoint
 *
 * Returns checkpoint metadata for a run:
 * - Whether a checkpoint exists
 * - Checkpoint status (awaiting_approval, approved, rejected)
 * - Interrupted node info
 * - Checkpoint history
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const run = await agentGraphRunService.getRun(params.id);
    if (!run) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const checkpointState = (run.state as any)?.checkpoint;
    const threadId = checkpointState?.threadId;

    let latestCheckpoint = null;
    let checkpointCount = 0;

    if (threadId) {
        try {
            latestCheckpoint = await getLatestCheckpoint(threadId);
            const allCheckpoints = await listCheckpoints(threadId, 100);
            checkpointCount = allCheckpoints.length;
        } catch {
            // Checkpoint service might be unavailable
        }
    }

    return NextResponse.json({
        runId: params.id,
        status: run.status,
        checkpoint: checkpointState ?? null,
        hasCheckpoint: !!latestCheckpoint,
        checkpointCount,
        isInterrupted:
            run.status === "PAUSED" &&
            checkpointState?.status === "awaiting_approval",
    });
}

/**
 * POST /api/sessions/[id]/checkpoint
 *
 * Actions on checkpoints:
 * - { action: "approve" }  — Resume from the interrupted checkpoint
 * - { action: "reject" }   — Reject the pending action and fail the node
 * - { action: "list" }     — List all checkpoints for this run
 *
 * For "approve" and "reject", this updates the run state. The actual
 * resume is handled by the /chat endpoint (which detects checkpoint
 * metadata and calls continueRun with resumeFromCheckpoint=true).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const run = await agentGraphRunService.getRun(params.id);
    if (!run) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "list") {
        const checkpointState = (run.state as any)?.checkpoint;
        const threadId = checkpointState?.threadId;
        if (!threadId) {
            return NextResponse.json({ checkpoints: [], count: 0 });
        }
        try {
            const checkpoints = await listCheckpoints(threadId);
            return NextResponse.json({
                checkpoints: checkpoints.map((cp: any) => ({
                    id: cp.checkpoint?.id,
                    ts: cp.checkpoint?.ts,
                    channelValues: cp.checkpoint?.channel_values
                        ? Object.keys(cp.checkpoint.channel_values)
                        : [],
                })),
                count: checkpoints.length,
            });
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error)?.message ?? "Failed to list checkpoints" },
                { status: 500 }
            );
        }
    }

    if (action === "reject") {
        const checkpointState = (run.state as any)?.checkpoint;
        if (!checkpointState || checkpointState.status !== "awaiting_approval") {
            return NextResponse.json(
                { error: "No pending checkpoint to reject" },
                { status: 400 }
            );
        }

        // Mark checkpoint as rejected and fail the run
        const updatedState = {
            ...run.state,
            checkpoint: {
                ...checkpointState,
                status: "rejected",
                approvedAt: new Date().toISOString(),
            },
        };

        await agentGraphRunService.updateRunStatus(params.id, "FAILED", {
            state: updatedState,
            endedAt: new Date(),
            error: "Human rejected the pending action at checkpoint.",
        } as any);

        return NextResponse.json({
            runId: params.id,
            status: "FAILED",
            checkpoint: updatedState.checkpoint,
            message: "Checkpoint action rejected. Run has been failed.",
        });
    }

    if (action === "approve") {
        // Approval is a signal — the actual resume happens via /chat
        // endpoint which detects the checkpoint state. We just verify
        // the state is correct here.
        const checkpointState = (run.state as any)?.checkpoint;
        if (!checkpointState || checkpointState.status !== "awaiting_approval") {
            return NextResponse.json(
                { error: "No pending checkpoint to approve" },
                { status: 400 }
            );
        }

        return NextResponse.json({
            runId: params.id,
            status: run.status,
            checkpoint: checkpointState,
            message:
                "Checkpoint is ready for approval. Send a follow-up message via /chat to resume execution.",
        });
    }

    return NextResponse.json({ error: "Unknown action. Use: approve, reject, list" }, { status: 400 });
}
