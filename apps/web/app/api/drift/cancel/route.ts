import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@kletron/server/lib/db";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export async function POST(req: Request) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { jobId } = await req.json();
        if (!jobId || !ObjectId.isValid(jobId)) {
            return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
        }

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const db = await getDb();
        const res = await db.collection("drift_analysis_jobs").updateOne(
            { _id: new ObjectId(jobId), workspaceId: workspace._id },
            { $set: { status: "cancelled" } }
        );

        if (!res.matchedCount) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to cancel drift job:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
