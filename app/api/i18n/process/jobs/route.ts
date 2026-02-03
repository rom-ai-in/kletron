import { NextResponse } from "next/server";

import { getDb } from "@/src/lib/db";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOBS_COLLECTION = "i18n_process_jobs";

export async function GET(req: Request) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const status = url.searchParams.get("status") ?? undefined;

  const limit = Math.min(Math.max(limitRaw ? Number.parseInt(limitRaw, 10) : 50, 1), 200);
  const offset = Math.max(offsetRaw ? Number.parseInt(offsetRaw, 10) : 0, 0);

  try {
    const db = await getDb();
    const col = db.collection(JOBS_COLLECTION);

    const filter: any = {};
    if (status) filter.status = status;

    const [total, docs] = await Promise.all([
      col.countDocuments(filter),
      col
        .find(filter, {
          projection: {
            selectionKeys: 0, // can be huge; we already have totalRows
          },
        })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
    ]);

    const jobs = docs.map((d: any) => ({
      id: String(d._id),
      status: d.status,
      createdAt: d.createdAt,
      startedAt: d.startedAt,
      finishedAt: d.finishedAt,
      totalRows: d.totalRows,
      processedRows: d.processedRows,
      nextIndex: d.nextIndex,
      chunkSize: d.chunkSize,
      llmSelection: d.llmSelection,
      resolvedLlm: d.resolvedLlm,
      error: d.error,
      attempts: d.attempts,
      log: Array.isArray(d.log) ? d.log : [],
    }));

    return NextResponse.json({ total, jobs });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to list jobs" }, { status: 500 });
  }
}

