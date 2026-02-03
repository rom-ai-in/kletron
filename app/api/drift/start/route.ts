import { NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { type DriftJobDoc } from "@/src/services/driftAnalysisWorker";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function POST(req: Request) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await req.json();
        const { llmSelection } = body;

        const db = await getDb();
        const jobs = db.collection<DriftJobDoc>("drift_analysis_jobs");

        const job: any = {
            status: "queued",
            createdAt: new Date(),
            attempts: 0,
            totalStages: 0,
            processedStages: 0,
            currentStageIndex: 0,
            results: [],
            llmSelection
        };

        const res = await jobs.insertOne(job as any);

        return NextResponse.json({ jobId: res.insertedId.toString() });
    } catch (error) {
        console.error("Failed to start drift job:", error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
