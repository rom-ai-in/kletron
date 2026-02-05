import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@numezis/server/lib/db";
import { bulkUpdateTranslations } from "@numezis/server/services/i18nTranslationsService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESULTS_COLLECTION = "i18n_process_job_results";

const BodySchema = z.object({
  jobId: z.string().min(1),
  mode: z.enum(["all_updates", "row_keys"]),
  rowKeys: z.array(z.string().min(1)).max(5000).optional(),
  batchSize: z.number().int().min(50).max(1000).optional(),
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

    let oid: ObjectId;
    try {
      oid = new ObjectId(body.jobId);
    } catch {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    if (body.mode === "row_keys" && (!body.rowKeys || body.rowKeys.length === 0)) {
      return NextResponse.json({ error: "rowKeys is required for mode=row_keys" }, { status: 400 });
    }

    const db = await getDb();
    const batchSize = body.batchSize ?? 500;

    const filter: any = { jobId: oid, decision: "UPDATE" };
    if (body.mode === "row_keys") {
      filter.rowKey = { $in: body.rowKeys };
    }

    const cursor = db
      .collection(RESULTS_COLLECTION)
      .find(filter, { projection: { _id: 0, rowKey: 1, proposed: 1 } })
      .sort({ rowKey: 1 })
      .batchSize(batchSize);

    let applied = 0;
    let matched = 0;
    let modified = 0;

    while (true) {
      const docs: Array<{ rowKey: string; proposed?: any }> = [];
      while (docs.length < batchSize) {
        // eslint-disable-next-line no-await-in-loop
        const next = await cursor.next();
        if (!next) break;
        docs.push(next as any);
      }
      if (docs.length === 0) break;

      const updates = docs
        .filter((d) => d && typeof d.rowKey === "string" && d.rowKey && d.proposed && typeof d.proposed === "object")
        .map((d) => ({ rowKey: d.rowKey, proposed: d.proposed as any }));

      if (updates.length) {
        // eslint-disable-next-line no-await-in-loop
        const res = await bulkUpdateTranslations(updates);
        applied += updates.length;
        matched += res.matched;
        modified += res.modified;
      }
    }

    return NextResponse.json({ success: true, applied, matched, modified });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to apply results" }, { status: 400 });
  }
}

