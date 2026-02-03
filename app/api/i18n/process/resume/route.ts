import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/src/lib/db";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOBS_COLLECTION = "i18n_process_jobs";

const BodySchema = z.object({
  jobId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = BodySchema.parse(await req.json());
    const force = body.force ?? false;

    let oid: ObjectId;
    try {
      oid = new ObjectId(body.jobId);
    } catch {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection(JOBS_COLLECTION);

    const job = await col.findOne(
      { _id: oid },
      { projection: { status: 1, heartbeatAt: 1, lockedAt: 1, lockId: 1, processedRows: 1, totalRows: 1 } }
    );
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (job.status !== "running") {
      return NextResponse.json({ error: `Job is not running (status=${job.status})` }, { status: 409 });
    }

    // Consider job stale if we haven't seen a heartbeat recently.
    const lastBeat = job.heartbeatAt ?? job.lockedAt;
    const staleMs = 2 * 60 * 1000;
    const isStale = !lastBeat ? true : Date.now() - new Date(lastBeat).getTime() > staleMs;
    if (!force && !isStale) {
      return NextResponse.json(
        { error: "Job appears to be actively running (recent heartbeat). Use force=true to re-queue anyway." },
        { status: 409 }
      );
    }

    const now = new Date();
    const res = await col.updateOne(
      { _id: oid, status: "running" },
      {
        $set: {
          status: "queued",
          heartbeatAt: now,
        },
        $unset: {
          lockId: "",
          lockedAt: "",
          finishedAt: "",
        },
        $push: {
          log: {
            $each: [
              `Manually re-queued by user at ${now.toISOString()}${force ? " (force)" : ""}.`,
            ],
            $slice: -80,
          },
        },
      } as any
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Job could not be re-queued (status changed)" }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to resume job" }, { status: 400 });
  }
}

