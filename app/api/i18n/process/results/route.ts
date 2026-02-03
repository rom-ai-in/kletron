import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/src/lib/db";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESULTS_COLLECTION = "i18n_process_job_results";

export async function GET(req: Request) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const onlyChanged = url.searchParams.get("onlyChanged") === "true";
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const limit = Math.min(Math.max(limitRaw ? Number.parseInt(limitRaw, 10) : 200, 1), 1000);
  const offset = Math.max(offsetRaw ? Number.parseInt(offsetRaw, 10) : 0, 0);

  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  let oid: ObjectId;
  try {
    oid = new ObjectId(jobId);
  } catch {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const filter: any = { jobId: oid };
    if (onlyChanged) filter.decision = "UPDATE";

    const col = db.collection(RESULTS_COLLECTION);
    const [total, rows] = await Promise.all([
      col.countDocuments(filter),
      col
        .find(filter, { projection: { _id: 0, jobId: 0 } })
        .sort({ namespace: 1, key: 1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
    ]);

    return NextResponse.json({ total, rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to fetch results" }, { status: 500 });
  }
}

