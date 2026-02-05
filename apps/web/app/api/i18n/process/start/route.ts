import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@numezis/server/lib/db";
import { resolveLlmSelection, resolveResolvedLlmInfo, type ResolvedLlmInfo } from "@numezis/server/llm";
import { I18nStatusSchema, buildTranslationsFilter, findRowKeysByFilter } from "@numezis/server/services/i18nTranslationsService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { LLM_PROVIDERS, type LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";

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
  checkpointId?: ObjectId;
  chunkSize: number;
  llmSelection?: { provider: string; model?: string };
  resolvedLlm?: ResolvedLlmInfo;
  // Legacy selection (materialized row keys).
  selectionKeys?: string[];
  // New: select-by-query (supports >5000 selections without materializing keys).
  selection?: {
    mode: "query";
    q?: string;
    namespace?: string;
    status?: z.infer<typeof I18nStatusSchema>;
    reviewed?: boolean;
    excludeRowKeys?: string[];
  };
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
    // If omitted, the job will process *all* matching rows (no materialized selectionKeys).
    limit: z.number().int().min(1).max(1_000_000).optional(),
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
        provider: z.enum(["azure", "openai", "claude", "gemini", "lmstudio", "ollama"]).optional(),
        model: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    selection: SelectionSchema,
    chunkSize: z.number().int().min(5).max(50).optional(),
    llmSelection: z
      .object({
        provider: z.enum(["azure", "openai", "claude", "gemini", "lmstudio", "ollama"]).optional(),
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
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({ "error": "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = BodySchema.parse(await req.json());
    const chunkSize = ("chunkSize" in body ? body.chunkSize : undefined) ?? 20;

    // Only override provider if explicitly requested; otherwise use DB-configured default.
    const llmSelection =
      "llmSelection" in body && body.llmSelection?.provider
        ? resolveLlmSelection(body.llmSelection)
        : undefined;
    const resolved = await resolveResolvedLlmInfo(llmSelection);
    if (resolved.provider === "lmstudio" && !resolved.model) {
      return NextResponse.json(
        { error: "LM Studio is selected but no model is configured. Configure it in the UI or specify a model." },
        { status: 400 }
      );
    }
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

    let selectionKeys: string[] | undefined = undefined;
    let selectionQuery: ProcessJobDoc["selection"] | undefined = undefined;
    let totalRows: number;

    if (selection.mode === "keys") {
      selectionKeys = selection.rowKeys;
      totalRows = selectionKeys.length;
    } else {
      const wantsAll = selection.limit === undefined;
      const limit = selection.limit ?? 5000;

      if (!wantsAll && limit <= 5000) {
        selectionKeys = await findRowKeysByFilter({
          q: selection.q,
          namespace: selection.namespace,
          status: selection.status,
          reviewed: selection.reviewed,
          limit,
          excludeRowKeys: selection.excludeRowKeys ?? [],
        });
        if (selectionKeys.length === 0) {
          return NextResponse.json({ error: "No rows match the current filters." }, { status: 400 });
        }
        totalRows = selectionKeys.length;
      } else {
        // Durable select-all job: store query instead of materializing row keys.
        selectionQuery = {
          mode: "query",
          q: selection.q,
          namespace: selection.namespace,
          status: selection.status,
          reviewed: selection.reviewed,
          excludeRowKeys: selection.excludeRowKeys ?? [],
        };
        const filter = buildTranslationsFilter({
          q: selectionQuery.q,
          namespace: selectionQuery.namespace,
          status: selectionQuery.status,
          reviewed: selectionQuery.reviewed,
          excludeRowKeys: selectionQuery.excludeRowKeys,
        });
        totalRows = await db.collection("i18n_translations").countDocuments(filter);
        if (!totalRows) {
          return NextResponse.json({ error: "No rows match the current filters." }, { status: 400 });
        }
      }
    }

    const jobId = new ObjectId();
    const insertDoc: ProcessJobDoc = {
      _id: jobId,
      status: "queued",
      createdAt: new Date(),
      totalRows,
      processedRows: 0,
      nextIndex: 0,
      chunkSize,
      llmSelection: llmSelection ? { provider: llmSelection.provider, model: llmSelection.model } : undefined,
      resolvedLlm: resolved,
      selectionKeys,
      selection: selectionQuery,
      log: [],
      attempts: 0,
    };
    await jobs.insertOne(insertDoc);

    await appendLogLine(db, jobId, `Job queued. rows=${totalRows}, chunkSize=${chunkSize}`);
    await appendLogLine(
      db,
      jobId,
      resolved.provider === "lmstudio"
        ? `LLM: lmstudio model=${resolved.model ?? "(missing)"} baseUrl=${resolved.lmstudio?.baseUrl ?? ""}`
        : `LLM: azure deployment=${resolved.azure?.deployment ?? ""} model=${resolved.model ?? ""} endpoint=${resolved.azure?.endpoint ?? ""}`
    );

    return NextResponse.json({ success: true, jobId: jobId.toString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to start job" }, { status: 400 });
  }
}
