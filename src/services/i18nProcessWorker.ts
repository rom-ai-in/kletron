import { ObjectId } from "mongodb";

import { getDb } from "@/src/lib/db";
import { resolveLlmSelection, resolveResolvedLlmInfo, type LlmSelection, type ResolvedLlmInfo } from "@/src/llm";
import { buildTranslationsFilter, getTranslationsByRowKeys, toRowKey, type I18nStatus } from "@/src/services/i18nTranslationsService";
import type { TranslationAgentRowInput } from "@/src/services/translationReactAgent";
import { computeChangedLocales, runTranslationAgentChunk } from "@/src/services/translationReactAgent";

export type I18nProcessJobStatus = "queued" | "running" | "success" | "error" | "cancelled";

export type I18nProcessJobDoc = {
  _id: ObjectId;
  status: I18nProcessJobStatus;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;

  totalRows: number;
  processedRows: number;
  nextIndex: number; // checkpoint into selectionKeys (legacy selection mode)
  checkpointId?: ObjectId; // checkpoint into Mongo _id (query selection mode)
  chunkSize: number;

  llmSelection?: { provider?: string; model?: string };
  resolvedLlm?: ResolvedLlmInfo;
  // Legacy selection: materialized row keys
  selectionKeys?: string[];
  // New selection: durable query (supports > 5k selections)
  selection?: {
    mode: "query";
    q?: string;
    namespace?: string;
    status?: I18nStatus;
    reviewed?: boolean;
    excludeRowKeys?: string[];
  };

  error?: string;
  log?: string[];

  // Lock + heartbeat (for crash recovery)
  lockId?: string;
  lockedAt?: Date;
  heartbeatAt?: Date;

  attempts?: number;
};

type I18nProcessResultDoc = {
  jobId: ObjectId;
  rowKey: string;
  namespace: string;
  key: string;
  original: { en: string; de: string; fr: string; it: string };
  proposed?: { en?: string; de?: string; fr?: string; it?: string };
  decision: "KEEP" | "UPDATE";
  changedLocales: Array<"en" | "de" | "fr" | "it">;
  confidence: number;
  rationale: string;
  evidence?: any[];
  createdAt: Date;
  updatedAt: Date;
};

const JOBS_COLLECTION = "i18n_process_jobs";
const RESULTS_COLLECTION = "i18n_process_job_results";

export type I18nWorkerOptions = {
  pollIntervalMs?: number;
  lockTtlMs?: number;
  heartbeatIntervalMs?: number;
  maxToolCallsPerChunk?: number;
  hardChunkTimeoutMs?: number;
};

const defaultOptions: Required<I18nWorkerOptions> = {
  pollIntervalMs: 1000,
  // Must be comfortably larger than worst-case chunk duration to avoid lock stealing.
  lockTtlMs: 30 * 60 * 1000, // 30 minutes
  heartbeatIntervalMs: 10 * 1000,
  maxToolCallsPerChunk: 25,
  hardChunkTimeoutMs: 10 * 60 * 1000,
};

function now() {
  return new Date();
}

async function ensureIndexes() {
  const db = await getDb();
  const jobs = db.collection<I18nProcessJobDoc>(JOBS_COLLECTION);
  const results = db.collection<I18nProcessResultDoc>(RESULTS_COLLECTION);
  try {
    await jobs.createIndex({ status: 1, createdAt: -1 });
    await jobs.createIndex({ heartbeatAt: 1 });
    await results.createIndex({ jobId: 1, decision: 1 });
    await results.createIndex({ jobId: 1, rowKey: 1 }, { unique: true });
  } catch {
    // ignore
  }
}

function isStaleLock(job: Pick<I18nProcessJobDoc, "heartbeatAt" | "lockedAt">, ttlMs: number) {
  const t = job.heartbeatAt ?? job.lockedAt;
  if (!t) return true;
  return Date.now() - new Date(t).getTime() > ttlMs;
}

async function appendLogLine(db: any, jobId: ObjectId, line: string) {
  await db.collection(JOBS_COLLECTION).updateOne(
    { _id: jobId },
    {
      $push: {
        log: {
          $each: [line],
          $slice: -80,
        },
      },
    }
  );
}

async function claimNextJob(lockId: string, opts: Required<I18nWorkerOptions>): Promise<I18nProcessJobDoc | null> {
  const db = await getDb();
  const jobs = db.collection<I18nProcessJobDoc>(JOBS_COLLECTION);

  // Find one queued job first, else recover stale running jobs.
  const staleBefore = new Date(Date.now() - opts.lockTtlMs);
  const query: any = {
    $or: [
      { status: "queued" },
      {
        status: "running",
        $or: [{ heartbeatAt: { $lt: staleBefore } }, { heartbeatAt: { $exists: false }, lockedAt: { $lt: staleBefore } }],
      },
    ],
  };

  const res = await jobs.findOneAndUpdate(
    query,
    {
      $set: {
        status: "running",
        lockId,
        lockedAt: now(),
        heartbeatAt: now(),
        startedAt: now(),
        error: undefined,
      },
      $inc: { attempts: 1 },
    } as any,
    { sort: { createdAt: 1 }, returnDocument: "after" }
  );

  // Different mongodb type packages disagree on return shape (value vs direct doc).
  const anyRes = res as any;
  const claimed = anyRes && typeof anyRes === "object" && "value" in anyRes ? ((anyRes.value as any) ?? null) : (anyRes ?? null);
  if (!claimed?._id) return null;

  // Defensive re-fetch: some driver/runtime combinations can return a partial document from findOneAndUpdate.
  // We need the full job payload (notably `selection` / `selectionKeys`) to decide processing mode correctly.
  const full = await jobs.findOne({ _id: claimed._id });
  return (full as any) ?? (claimed as any);
}

async function heartbeat(jobId: ObjectId, lockId: string) {
  const db = await getDb();
  await db.collection(JOBS_COLLECTION).updateOne(
    { _id: jobId, lockId, status: "running" },
    { $set: { heartbeatAt: now() } }
  );
}

async function isCancelled(jobId: ObjectId) {
  const db = await getDb();
  const job = await db.collection(JOBS_COLLECTION).findOne({ _id: jobId }, { projection: { status: 1 } });
  return job?.status === "cancelled";
}

function dedupeRecommendations(recs: Array<{ rowKey: string; decision: "KEEP" | "UPDATE";[k: string]: any }>) {
  const recByKey = new Map<string, (typeof recs)[number]>();
  for (const rec of recs) {
    const existing = recByKey.get(rec.rowKey);
    if (!existing) {
      recByKey.set(rec.rowKey, rec);
      continue;
    }
    if (existing.decision !== "UPDATE" && rec.decision === "UPDATE") {
      recByKey.set(rec.rowKey, rec);
      continue;
    }
    recByKey.set(rec.rowKey, rec);
  }
  return Array.from(recByKey.values());
}

function normalizeRowKey(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function coerceDecision(value: unknown): "KEEP" | "UPDATE" | null {
  if (value === "KEEP" || value === "UPDATE") return value;
  return null;
}

function filterAndAlignRecommendationsToInputs(
  inputRowKeys: string[],
  recs: Array<{ rowKey: unknown; decision?: unknown;[k: string]: any }>
) {
  const allowed = new Set(inputRowKeys);
  let invalidRowKeyCount = 0;
  let invalidDecisionCount = 0;

  const matched: Array<{ rowKey: string; decision: "KEEP" | "UPDATE";[k: string]: any }> = [];
  for (const rec of recs ?? []) {
    const rk = normalizeRowKey(rec?.rowKey);
    if (!rk || !allowed.has(rk)) {
      invalidRowKeyCount += 1;
      continue;
    }
    const decision = coerceDecision(rec?.decision);
    if (!decision) {
      invalidDecisionCount += 1;
      continue;
    }
    matched.push({ ...rec, rowKey: rk, decision });
  }

  // De-dupe again after normalization and dropping invalids
  const deduped = dedupeRecommendations(matched);
  const have = new Set(deduped.map((r) => r.rowKey));
  const missing = inputRowKeys.filter((rk) => !have.has(rk));

  return { deduped, missing, invalidRowKeyCount, invalidDecisionCount };
}

async function processJob(job: I18nProcessJobDoc, lockId: string, opts: Required<I18nWorkerOptions>) {
  const db = await getDb();
  const jobs = db.collection<I18nProcessJobDoc>(JOBS_COLLECTION);
  const results = db.collection<I18nProcessResultDoc>(RESULTS_COLLECTION);

  const selectionKeys = job.selectionKeys ?? [];
  const totalRows = Math.max(0, job.totalRows ?? selectionKeys.length);
  let nextIndex = Math.max(0, Math.min(job.nextIndex ?? 0, selectionKeys.length));
  let processedRows = Math.max(0, Math.min(job.processedRows ?? 0, totalRows));
  let checkpointId: ObjectId | undefined = job.checkpointId;
  const chunkSize = Math.max(5, Math.min(job.chunkSize ?? 20, 50));

  const llmSelection: Partial<LlmSelection> | undefined = job.llmSelection?.provider
    ? resolveLlmSelection(job.llmSelection)
    : undefined;
  const resolved = await resolveResolvedLlmInfo(llmSelection);
  if (!job.resolvedLlm) {
    await jobs.updateOne(
      { _id: job._id, lockId, status: "running" },
      { $set: { resolvedLlm: resolved } }
    );
    await appendLogLine(
      db,
      job._id,
      resolved.provider === "lmstudio"
        ? `LLM: lmstudio model=${resolved.model ?? "(missing)"} baseUrl=${resolved.lmstudio?.baseUrl ?? ""}`
        : `LLM: azure deployment=${resolved.azure?.deployment ?? ""} model=${resolved.model ?? ""} endpoint=${resolved.azure?.endpoint ?? ""}`
    );
  }

  await appendLogLine(
    db,
    job._id,
    job.selection?.mode === "query"
      ? `Worker claimed job. rows=${totalRows}, chunkSize=${chunkSize}, checkpointId=${checkpointId ? String(checkpointId) : "(none)"}`
      : `Worker claimed job. rows=${selectionKeys.length}, chunkSize=${chunkSize}, nextIndex=${nextIndex}`
  );

  // Heartbeat runs independently so long chunks don't look stale.
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const startHeartbeat = () => {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      void heartbeat(job._id, lockId);
    }, opts.heartbeatIntervalMs);
  };
  const stopHeartbeat = () => {
    if (!heartbeatTimer) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  startHeartbeat();

  try {
    // Query selection mode (durable select-all without materializing keys).
    if (job.selection?.mode === "query") {
      const translations = db.collection("i18n_translations");
      const baseFilter = buildTranslationsFilter({
        q: job.selection.q,
        namespace: job.selection.namespace,
        status: job.selection.status,
        reviewed: job.selection.reviewed,
        excludeRowKeys: job.selection.excludeRowKeys,
      });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (await isCancelled(job._id)) {
          await appendLogLine(db, job._id, "Job cancelled by user.");
          return;
        }

        const filter: any = checkpointId
          ? { $and: [baseFilter, { _id: { $gt: checkpointId } }] }
          : baseFilter;

        const chunkDocs = (await translations
          .find(filter, {
            projection: {
              _id: 1,
              namespace: 1,
              key: 1,
              source_file: 1,
              context_usage: 1,
              status: 1,
              en: 1,
              de: 1,
              fr: 1,
              it: 1,
            },
          })
          .sort({ _id: 1 })
          .limit(chunkSize)
          .toArray()) as any[];

        if (!chunkDocs.length) break;

        const agentRows: TranslationAgentRowInput[] = chunkDocs.map((r) => ({
          rowKey: toRowKey(r),
          namespace: r?.namespace ?? "",
          key: r?.key ?? "",
          source_file: r?.source_file ?? "",
          context_usage: r?.context_usage ?? "",
          status: r?.status,
          en: r?.en ?? "",
          de: r?.de ?? "",
          fr: r?.fr ?? "",
          it: r?.it ?? "",
        }));

        const chunkIndex = Math.floor(processedRows / chunkSize) + 1;
        await appendLogLine(db, job._id, `Running chunk ${chunkIndex} (${agentRows.length} rows)…`);

        // Hard timeout guard per chunk
        const chunkPromise = runTranslationAgentChunk({
          rows: agentRows,
          llmSelection,
          maxToolCalls: opts.maxToolCallsPerChunk,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error(`Chunk timed out after ${Math.round(opts.hardChunkTimeoutMs / 1000)}s`));
          }, opts.hardChunkTimeoutMs);
        });

        const { output } = await Promise.race([chunkPromise, timeoutPromise]);

        const inputRowKeys = agentRows.map((r) => r.rowKey);
        const aligned = filterAndAlignRecommendationsToInputs(inputRowKeys, output.recommendations as any);
        const deduped = aligned.deduped;
        const missing = aligned.missing;

        if (aligned.invalidRowKeyCount || aligned.invalidDecisionCount) {
          await appendLogLine(
            db,
            job._id,
            `Model returned ${deduped.length}/${agentRows.length} valid recommendations; ignored ${aligned.invalidRowKeyCount} with unknown rowKey and ${aligned.invalidDecisionCount} with invalid decision.`
          );
        }

        if (missing.length) {
          await appendLogLine(
            db,
            job._id,
            `Model returned ${deduped.length}/${agentRows.length} recommendations; defaulting ${missing.length} to KEEP.`
          );
          for (const rk of missing) {
            deduped.push({
              rowKey: rk,
              decision: "KEEP",
              confidence: 0.25,
              rationale: "Model did not return a recommendation for this row in the chunk output; defaulted to KEEP.",
              proposed: undefined,
              evidence: [],
            });
          }
        }

        const tNow = now();
        const originalByRowKey = new Map(agentRows.map((r) => [r.rowKey, r]));
        const docs: I18nProcessResultDoc[] = deduped.map((rec: any) => {
          const originalRow = originalByRowKey.get(rec.rowKey) ?? agentRows[0];
          const changedLocales = computeChangedLocales(originalRow, rec.proposed);
          return {
            jobId: job._id,
            rowKey: rec.rowKey,
            namespace: originalRow.namespace,
            key: originalRow.key,
            original: {
              en: originalRow.en ?? "",
              de: originalRow.de ?? "",
              fr: originalRow.fr ?? "",
              it: originalRow.it ?? "",
            },
            proposed: rec.proposed,
            decision: rec.decision,
            changedLocales,
            confidence: rec.confidence,
            rationale: rec.rationale,
            evidence: rec.evidence,
            createdAt: tNow,
            updatedAt: tNow,
          };
        });

        const updateCount = docs.filter((d) => d.decision === "UPDATE").length;
        const keepCount = docs.length - updateCount;
        await appendLogLine(db, job._id, `Chunk ${chunkIndex} results: ${updateCount} UPDATE, ${keepCount} KEEP.`);

        if (docs.length) {
          await results.bulkWrite(
            docs.map((d) => ({
              updateOne: {
                filter: { jobId: d.jobId, rowKey: d.rowKey },
                update: {
                  $set: {
                    jobId: d.jobId,
                    rowKey: d.rowKey,
                    namespace: d.namespace,
                    key: d.key,
                    original: d.original,
                    proposed: d.proposed,
                    decision: d.decision,
                    changedLocales: d.changedLocales,
                    confidence: d.confidence,
                    rationale: d.rationale,
                    evidence: d.evidence,
                    updatedAt: d.updatedAt,
                  },
                  $setOnInsert: { createdAt: d.createdAt },
                },
                upsert: true,
              },
            })),
            { ordered: false }
          );
        }

        // Commit checkpoint after chunk completes
        checkpointId = chunkDocs[chunkDocs.length - 1]?._id as ObjectId;
        processedRows += agentRows.length;

        await jobs.updateOne(
          { _id: job._id, lockId, status: "running" },
          {
            $set: {
              processedRows,
              checkpointId,
              totalRows,
              heartbeatAt: now(),
            },
          }
        );
      }

      await jobs.updateOne(
        { _id: job._id, lockId, status: "running" },
        {
          $set: {
            status: "success",
            finishedAt: now(),
            processedRows,
            heartbeatAt: now(),
          },
          $unset: {
            lockId: "",
            lockedAt: "",
          },
        } as any
      );
      await appendLogLine(db, job._id, "Job completed successfully.");
      return;
    }

    // Legacy selection mode (materialized keys).
    while (nextIndex < selectionKeys.length) {

      if (await isCancelled(job._id)) {
        await appendLogLine(db, job._id, "Job cancelled by user.");
        return;
      }

      const chunkKeys = selectionKeys.slice(nextIndex, nextIndex + chunkSize);
      const chunkRows = await getTranslationsByRowKeys(chunkKeys);
      const rowMap = new Map(chunkRows.map((r) => [toRowKey(r), r]));

      const agentRows: TranslationAgentRowInput[] = chunkKeys.map((rk) => {
        const r = rowMap.get(rk);
        return {
          rowKey: rk,
          namespace: r?.namespace ?? rk.split(".")[0] ?? "",
          key: r?.key ?? rk.split(".").slice(1).join(".") ?? "",
          source_file: r?.source_file ?? "",
          context_usage: r?.context_usage ?? "",
          status: r?.status,
          en: r?.en ?? "",
          de: r?.de ?? "",
          fr: r?.fr ?? "",
          it: r?.it ?? "",
        };
      });

      const chunkIndex = Math.floor(nextIndex / chunkSize) + 1;
      await appendLogLine(db, job._id, `Running chunk ${chunkIndex} (${chunkKeys.length} rows)…`);

      // Hard timeout guard per chunk
      const chunkPromise = runTranslationAgentChunk({
        rows: agentRows,
        llmSelection,
        maxToolCalls: opts.maxToolCallsPerChunk,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error(`Chunk timed out after ${Math.round(opts.hardChunkTimeoutMs / 1000)}s`));
        }, opts.hardChunkTimeoutMs);
      });

      const { output } = await Promise.race([chunkPromise, timeoutPromise]);

      // The model can omit rows or return wrong rowKeys. We enforce 1 result per *input* rowKey.
      const aligned = filterAndAlignRecommendationsToInputs(chunkKeys, output.recommendations as any);
      const deduped = aligned.deduped;
      const missing = aligned.missing;

      if (aligned.invalidRowKeyCount || aligned.invalidDecisionCount) {
        await appendLogLine(
          db,
          job._id,
          `Model returned ${deduped.length}/${chunkKeys.length} valid recommendations; ignored ${aligned.invalidRowKeyCount} with unknown rowKey and ${aligned.invalidDecisionCount} with invalid decision.`
        );
      }

      if (missing.length) {
        await appendLogLine(
          db,
          job._id,
          `Model returned ${deduped.length}/${chunkKeys.length} recommendations; defaulting ${missing.length} to KEEP.`
        );
        for (const rk of missing) {
          deduped.push({
            rowKey: rk,
            decision: "KEEP",
            confidence: 0.25,
            rationale: "Model did not return a recommendation for this row in the chunk output; defaulted to KEEP.",
            proposed: undefined,
            evidence: [],
          });
        }
      }

      const tNow = now();
      const originalByRowKey = new Map(agentRows.map((r) => [r.rowKey, r]));
      const docs: I18nProcessResultDoc[] = deduped.map((rec: any) => {
        const originalRow = originalByRowKey.get(rec.rowKey) ?? agentRows[0];
        const changedLocales = computeChangedLocales(originalRow, rec.proposed);
        return {
          jobId: job._id,
          rowKey: rec.rowKey,
          namespace: originalRow.namespace,
          key: originalRow.key,
          original: {
            en: originalRow.en ?? "",
            de: originalRow.de ?? "",
            fr: originalRow.fr ?? "",
            it: originalRow.it ?? "",
          },
          proposed: rec.proposed,
          decision: rec.decision,
          changedLocales,
          confidence: rec.confidence,
          rationale: rec.rationale,
          evidence: rec.evidence,
          createdAt: tNow,
          updatedAt: tNow,
        };
      });

      const updateCount = docs.filter((d) => d.decision === "UPDATE").length;
      const keepCount = docs.length - updateCount;
      await appendLogLine(db, job._id, `Chunk ${chunkIndex} results: ${updateCount} UPDATE, ${keepCount} KEEP.`);

      if (docs.length) {
        await results.bulkWrite(
          docs.map((d) => ({
            updateOne: {
              filter: { jobId: d.jobId, rowKey: d.rowKey },
              update: {
                $set: {
                  jobId: d.jobId,
                  rowKey: d.rowKey,
                  namespace: d.namespace,
                  key: d.key,
                  original: d.original,
                  proposed: d.proposed,
                  decision: d.decision,
                  changedLocales: d.changedLocales,
                  confidence: d.confidence,
                  rationale: d.rationale,
                  evidence: d.evidence,
                  updatedAt: d.updatedAt,
                },
                $setOnInsert: { createdAt: d.createdAt },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }

      // Commit checkpoint after chunk completes
      nextIndex += chunkKeys.length;
      processedRows = Math.min(totalRows, processedRows + chunkKeys.length);

      await jobs.updateOne(
        { _id: job._id, lockId, status: "running" },
        {
          $set: {
            processedRows,
            nextIndex,
            totalRows,
            heartbeatAt: now(),
          },
        }
      );
    }

    await jobs.updateOne(
      { _id: job._id, lockId, status: "running" },
      {
        $set: {
          status: "success",
          finishedAt: now(),
          processedRows,
          nextIndex,
          heartbeatAt: now(),
        },
        $unset: {
          lockId: "",
          lockedAt: "",
        },
      } as any
    );
    await appendLogLine(db, job._id, "Job completed successfully.");
  } finally {
    stopHeartbeat();
  }
}

export class I18nProcessWorker {
  private readonly lockId: string;
  private readonly opts: Required<I18nWorkerOptions>;
  private stopped = false;

  constructor(options?: I18nWorkerOptions) {
    this.lockId = `i18n-worker-${process.pid}-${Math.random().toString(16).slice(2)}`;
    this.opts = { ...defaultOptions, ...(options ?? {}) };
  }

  async runOnce(): Promise<boolean> {
    await ensureIndexes();
    const job = await claimNextJob(this.lockId, this.opts);
    if (!job) return false;

    try {
      // Recover stale locks: if a job is running but stale, we claimed it above.
      await processJob(job, this.lockId, this.opts);
    } catch (e) {
      const db = await getDb();
      await appendLogLine(db, job._id, `Job failed: ${(e as Error).message || String(e)}`);
      await db.collection(JOBS_COLLECTION).updateOne(
        { _id: job._id, lockId: this.lockId },
        {
          $set: {
            status: "error",
            error: (e as Error).message || "Processing failed",
            finishedAt: now(),
            heartbeatAt: now(),
          },
          $unset: { lockId: "", lockedAt: "" },
        } as any
      );
    }
    return true;
  }

  stop() {
    this.stopped = true;
  }

  async start() {
    await ensureIndexes();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.stopped) return;
      const didWork = await this.runOnce();
      if (!didWork) {
        await new Promise((r) => setTimeout(r, this.opts.pollIntervalMs));
      }
    }
  }
}
