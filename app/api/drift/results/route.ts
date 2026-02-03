import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/src/lib/db";
import { type DriftJobDoc } from "@/src/services/driftAnalysisWorker";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

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
    const onlyDetected = searchParams.get("onlyDetected") === "true";

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

        let rows = job.results || [];
        if (onlyDetected) {
            rows = rows.filter(r => r.driftDetected);
        }

        return NextResponse.json({ total: job.totalStages, rows });
    } catch (error) {
        console.error("Failed to fetch drift results:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
