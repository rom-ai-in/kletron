import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/src/lib/db";
import { type DriftJobDoc } from "@/src/services/driftAnalysisWorker";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId || !ObjectId.isValid(jobId)) {
        return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    try {
        const db = await getDb();
        const job = await db
            .collection<DriftJobDoc>("drift_analysis_jobs")
            .findOne({ _id: new ObjectId(jobId) });

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
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to fetch drift status:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
