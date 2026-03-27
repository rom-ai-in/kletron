import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@kletron/server/lib/db";
import { type DriftJobDoc } from "@kletron/server/services/driftAnalysisWorker";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export async function GET(req: Request) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId || !ObjectId.isValid(jobId)) {
        return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    try {
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const db = await getDb();
        const job = await db
            .collection<DriftJobDoc>("drift_analysis_jobs")
            .findOne({ _id: new ObjectId(jobId), workspaceId: workspace._id });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        // Only return fields needed for status polling/progress
        const result = {
            _id: job._id,
            status: job.status,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            totalStages: job.totalStages,
            processedStages: job.processedStages,
            currentStageIndex: job.currentStageIndex,
            error: job.error,
            log: job.log,
            resolvedLlm: job.resolvedLlm,
            llmSelection: job.llmSelection,
            systemPrompt: job.systemPrompt,
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to fetch drift status:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
