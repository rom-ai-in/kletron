import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/src/lib/db";
import { resolveLlmSelection } from "@/src/llm";
import { I18nStatusSchema, findRowKeysByFilter } from "@/src/services/i18nTranslationsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProcessJobDoc = {
  _id: ObjectId;
  status: "queued" | "running" | "success" | "error" | "cancelled";
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  totalRows: number;
  processedRows: number;
  nextIndex: number;
  chunkSize: number;
  llmSelection?: { provider: string; model?: string };
  selectionKeys: string[];
  error?: string;
  log?: string[];
  lockId?: string;
  lockedAt?: Date;
  heartbeatAt?: Date;
  attempts?: number;
};

const JOBS_COLLECTION = "i18n_process_jobs";

const SelectionSchema = z.union([
  z.object({
    mode: z.literal("keys"),
    rowKeys: z.array(z.string().min(1)).min(1).max(5000),
  }),
  z.object({
    mode: z.literal("query"),
    q: z.string().optional(),
    namespace: z.string().optional(),
    status: I18nStatusSchema.optional(),
    reviewed: z.boolean().optional(),
    limit: z.number().int().min(1).max(5000).optional(),
    excludeRowKeys: z.array(z.string().min(1)).max(5000).optional(),
  }),
]);

const BodySchema = z.union([
  z.object({
    // legacy shape
    rowKeys: z.array(z.string().min(1)).min(1).max(5000),
    chunkSize: z.number().int().min(5).max(50).optional(),
    llmSelection: z
      .object({
        provider: z.string().optional(),
        model: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    selection: SelectionSchema,
    chunkSize: z.number().int().min(5).max(50).optional(),
    llmSelection: z
      .object({
        provider: z.string().optional(),
        model: z.string().optional(),
      })
      .optional(),
  }),
]);

async function appendLogLine(db: any, jobId: ObjectId, line: string) {
  await db.collection(JOBS_COLLECTION).updateOne(
    { _id: jobId },
    {
      $push: {
        log: {
          $each: [line],
          $slice: -50,
        },
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const chunkSize = ("chunkSize" in body ? body.chunkSize : undefined) ?? 20;

    const llmSelection = resolveLlmSelection(("llmSelection" in body ? body.llmSelection : undefined) as any);
    const db = await getDb();
    const jobs = db.collection<ProcessJobDoc>(JOBS_COLLECTION);

    // Best-effort indexes
    try {
      await jobs.createIndex({ createdAt: -1 });
      await jobs.createIndex({ status: 1, createdAt: -1 });
    } catch {
      // ignore
    }

    const selection =
      "rowKeys" in body
        ? ({ mode: "keys", rowKeys: body.rowKeys } as const)
        : (body.selection as z.infer<typeof SelectionSchema>);

    let selectionKeys: string[] = [];
    if (selection.mode === "keys") {
      selectionKeys = selection.rowKeys;
    } else {
      selectionKeys = await findRowKeysByFilter({
        q: selection.q,
        namespace: selection.namespace,
        status: selection.status,
        reviewed: selection.reviewed,
        limit: selection.limit ?? 5000,
        excludeRowKeys: selection.excludeRowKeys ?? [],
      });
      if (selectionKeys.length === 0) {
        return NextResponse.json({ error: "No rows match the current filters." }, { status: 400 });
      }
    }

    const jobId = new ObjectId();
    const insertDoc: ProcessJobDoc = {
      _id: jobId,
      status: "queued",
      createdAt: new Date(),
      totalRows: selectionKeys.length,
      processedRows: 0,
      nextIndex: 0,
      chunkSize,
      llmSelection: { provider: llmSelection.provider, model: llmSelection.model },
      selectionKeys,
      log: [],
      attempts: 0,
    };
    await jobs.insertOne(insertDoc);

    await appendLogLine(db, jobId, `Job queued. rows=${selectionKeys.length}, chunkSize=${chunkSize}`);

    return NextResponse.json({ success: true, jobId: jobId.toString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to start job" }, { status: 400 });
  }
}

