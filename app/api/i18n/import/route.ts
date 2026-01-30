import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/src/lib/db";
import { importTranslations, parseTranslationCsv } from "@/src/services/i18nTranslationsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImportJobDoc = {
  _id: ObjectId;
  status: "running" | "success" | "error";
  phase: "queued" | "parsing" | "importing";
  replaceAll: boolean;
  startedAt: Date;
  finishedAt?: Date;
  totalRows?: number;
  processedRows?: number;
  upserted?: number;
  modified?: number;
  inserted?: number;
  error?: string;
};

const JOBS_COLLECTION = "i18n_import_jobs";

async function getJobsCollection() {
  const db = await getDb();
  const col = db.collection<ImportJobDoc>(JOBS_COLLECTION);
  // Best-effort indexes (ignore failures)
  try {
    await col.createIndex({ startedAt: -1 });
  } catch {
    // ignore
  }
  return col;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const replaceAllRaw = form.get("replaceAll");
    const replaceAll =
      replaceAllRaw === "true" || replaceAllRaw === "1" || replaceAllRaw === "on" || replaceAllRaw === "yes";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing CSV file (field name: file)" }, { status: 400 });
    }

    const csvText = await file.text();

    const jobs = await getJobsCollection();
    const startedAt = new Date();
    const insertRes = await jobs.insertOne({
      _id: new ObjectId(),
      status: "running",
      phase: "queued",
      replaceAll,
      startedAt,
      processedRows: 0,
      upserted: 0,
      modified: 0,
      inserted: 0,
    });
    const jobId = insertRes.insertedId.toString();

    // Fire-and-forget background processing (dev/local friendly).
    void (async () => {
      try {
        await jobs.updateOne({ _id: insertRes.insertedId }, { $set: { phase: "parsing" } });
        const { rows, errors } = parseTranslationCsv(csvText, file.name);

        if (errors.length) {
          await jobs.updateOne(
            { _id: insertRes.insertedId },
            {
              $set: {
                status: "error",
                phase: "parsing",
                error: `CSV validation failed:\n${errors.slice(0, 50).join("\n")}`,
                finishedAt: new Date(),
                totalRows: rows.length,
              },
            }
          );
          return;
        }

        await jobs.updateOne(
          { _id: insertRes.insertedId },
          { $set: { phase: "importing", totalRows: rows.length, processedRows: 0 } }
        );

        // Import in batches so we can update progress.
        const batchSize = 1000;
        let processedRows = 0;
        let upserted = 0;
        let modified = 0;
        let inserted = 0;

        if (replaceAll) {
          // use the existing import function for deleteMany, but do it once and then per-batch without replaceAll
          await importTranslations({ rows: [], replaceAll: true });
        }

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const r = await importTranslations({ rows: batch, replaceAll: false });
          processedRows += batch.length;
          upserted += r.upserted;
          modified += r.modified;
          inserted += r.inserted;

          await jobs.updateOne(
            { _id: insertRes.insertedId },
            {
              $set: {
                processedRows,
                upserted,
                modified,
                inserted,
              },
            }
          );
        }

        await jobs.updateOne(
          { _id: insertRes.insertedId },
          {
            $set: {
              status: "success",
              phase: "importing",
              processedRows,
              upserted,
              modified,
              inserted,
              finishedAt: new Date(),
            },
          }
        );
      } catch (e) {
        await jobs.updateOne(
          { _id: insertRes.insertedId },
          {
            $set: {
              status: "error",
              error: (e as Error).message || "Import failed",
              finishedAt: new Date(),
            },
          }
        );
      }
    })();

    return NextResponse.json({ success: true, jobId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Import failed" }, { status: 500 });
  }
}
