import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOBS_COLLECTION = "i18n_import_jobs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  let oid: ObjectId;
  try {
    oid = new ObjectId(jobId);
  } catch {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const job = await db
      .collection(JOBS_COLLECTION)
      .findOne({ _id: oid }, { projection: { _id: 0 } });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to read job" }, { status: 500 });
  }
}

