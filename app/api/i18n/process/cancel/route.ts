import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOBS_COLLECTION = "i18n_process_jobs";

const BodySchema = z.object({
  jobId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    let oid: ObjectId;
    try {
      oid = new ObjectId(body.jobId);
    } catch {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    const db = await getDb();
    const res = await db.collection(JOBS_COLLECTION).updateOne(
      { _id: oid, status: { $in: ["queued", "running"] } },
      { $set: { status: "cancelled", finishedAt: new Date(), heartbeatAt: new Date() }, $unset: { lockId: "", lockedAt: "" } as any }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Job not found or not cancellable" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to cancel job" }, { status: 400 });
  }
}

