import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/src/lib/db";

export async function POST(req: Request) {
    try {
        const { jobId } = await req.json();
        if (!jobId || !ObjectId.isValid(jobId)) {
            return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
        }

        const db = await getDb();
        await db.collection("drift_analysis_jobs").updateOne(
            { _id: new ObjectId(jobId) },
            { $set: { status: "cancelled" } }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to cancel drift job:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
