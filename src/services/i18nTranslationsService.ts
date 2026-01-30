import { z } from "zod";
import { parse as parseCsv } from "csv-parse/sync";
import type { Collection, Db } from "mongodb";
import { getDb } from "@/src/lib/db";
 
export const I18nStatusSchema = z.enum(["active", "unused"]);
export type I18nStatus = z.infer<typeof I18nStatusSchema>;
 
export const TranslationRecordSchema = z.object({
  key: z.string().min(1),
  namespace: z.string().min(1),
  source_file: z.string().min(1),
  context_usage: z.string().optional().default(""),
  en: z.string().optional().default(""),
  de: z.string().optional().default(""),
  fr: z.string().optional().default(""),
  it: z.string().optional().default(""),
  status: I18nStatusSchema.optional(),
  reviewed: z
    .preprocess((v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v === 1;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (["true", "1", "yes", "y"].includes(s)) return true;
        if (["false", "0", "no", "n"].includes(s)) return false;
      }
      return v;
    }, z.boolean())
    .optional(),
});
 
export type TranslationRecord = z.infer<typeof TranslationRecordSchema> & {
  createdAt?: Date;
  updatedAt?: Date;
  reviewedAt?: Date | null;
};
 
export function toRowKey(record: Pick<TranslationRecord, "namespace" | "key">) {
  return `${record.namespace}.${record.key}`;
}

export function parseRowKey(rowKey: string): { namespace: string; key: string } | null {
  const trimmed = rowKey.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return null;
  const namespace = trimmed.slice(0, dot).trim();
  const key = trimmed.slice(dot + 1).trim();
  if (!namespace || !key) return null;
  return { namespace, key };
}

export function buildTranslationsFilter(opts: {
  q?: string;
  namespace?: string;
  status?: I18nStatus;
  reviewed?: boolean;
  excludeRowKeys?: string[];
}) {
  const and: any[] = [];
  if (opts.namespace) and.push({ namespace: opts.namespace });
  if (opts.status) and.push({ status: opts.status });
  if (typeof opts.reviewed === "boolean") {
    if (opts.reviewed) and.push({ reviewed: true });
    else and.push({ $or: [{ reviewed: false }, { reviewed: { $exists: false } }] });
  }
  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim();
    and.push({
      $or: [
        { key: { $regex: q, $options: "i" } },
        { namespace: { $regex: q, $options: "i" } },
        { source_file: { $regex: q, $options: "i" } },
        { context_usage: { $regex: q, $options: "i" } },
        { en: { $regex: q, $options: "i" } },
        { de: { $regex: q, $options: "i" } },
        { fr: { $regex: q, $options: "i" } },
        { it: { $regex: q, $options: "i" } },
      ],
    });
  }

  const excludePairs = (opts.excludeRowKeys ?? [])
    .map((rk) => parseRowKey(rk))
    .filter(Boolean) as Array<{ namespace: string; key: string }>;
  if (excludePairs.length) {
    and.push({ $nor: excludePairs.map((p) => ({ namespace: p.namespace, key: p.key })) });
  }

  return and.length ? { $and: and } : {};
}

const DEFAULT_IMPORT_SOURCE_FILE = "import";

const HEADER_ALIAS_MAP: Record<string, keyof TranslationRecord> = {
  key: "key",
  namespace: "namespace",
  source_file: "source_file",
  sourcefile: "source_file",
  source: "source_file",
  context_usage: "context_usage",
  context: "context_usage",
  en: "en",
  de: "de",
  fr: "fr",
  it: "it",
  status: "status",
  reviewed: "reviewed",
};

function normalizeHeaderName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapHeaderToField(headerName: string): keyof TranslationRecord | undefined {
  const normalized = normalizeHeaderName(headerName);
  if (!normalized) return undefined;
  if (HEADER_ALIAS_MAP[normalized]) return HEADER_ALIAS_MAP[normalized];
  if (normalized.startsWith("english")) return "en";
  if (normalized.startsWith("german")) return "de";
  if (normalized.startsWith("french")) return "fr";
  if (normalized.startsWith("italian")) return "it";
  if (normalized.startsWith("source") && normalized.includes("file")) return "source_file";
  if (normalized.startsWith("context")) return "context_usage";
  if (normalized === "key" || normalized === "row_key") return "key";
  return undefined;
}

function buildCanonicalRow(
  row: Record<string, unknown>,
  defaultSourceFile?: string
): Record<keyof TranslationRecord, unknown> {
  const canonical: Partial<Record<keyof TranslationRecord, unknown>> = {};
  for (const [header, value] of Object.entries(row)) {
    const field = mapHeaderToField(header);
    if (!field) continue;
    canonical[field] = value;
  }

  const trimmedSource = typeof canonical.source_file === "string" ? canonical.source_file.trim() : "";
  if (!trimmedSource) {
    const fallback = defaultSourceFile?.trim();
    canonical.source_file = fallback && fallback.length ? fallback : DEFAULT_IMPORT_SOURCE_FILE;
  }

  return canonical as Record<keyof TranslationRecord, unknown>;
}

const COLLECTION_NAME = "i18n_translations";
 
let didEnsureIndexes = false;
async function ensureIndexes(db: Db) {
  if (didEnsureIndexes) return;
  const col = db.collection(COLLECTION_NAME);
  await col.createIndex({ namespace: 1, key: 1 }, { unique: true });
  await col.createIndex({ status: 1 });
  await col.createIndex({ namespace: 1 });
  await col.createIndex({ reviewed: 1 });
  didEnsureIndexes = true;
}
 
async function getCollection(): Promise<Collection<TranslationRecord>> {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection<TranslationRecord>(COLLECTION_NAME);
}
 
function detectDelimiter(headerLine: string): "," | "\t" | ";" {
  const comma = (headerLine.match(/,/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
 
  if (tab >= comma && tab >= semi) return "\t";
  if (semi >= comma && semi >= tab) return ";";
  return ",";
}
 
export function parseTranslationCsv(
  csvText: string,
  defaultSourceFile?: string
): { rows: TranslationRecord[]; errors: string[] } {
  const errors: string[] = [];
 
  const firstLine = csvText.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const delimiter = detectDelimiter(firstLine);
 
  let raw: Array<Record<string, unknown>> = [];
  try {
    raw = parseCsv(csvText, {
      columns: true,
      delimiter,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      trim: true,
    }) as Array<Record<string, unknown>>;
  } catch (e) {
    return { rows: [], errors: [`Failed to parse CSV: ${(e as Error).message}`] };
  }
 
  const rows: TranslationRecord[] = [];
  const canonicalRows = raw.map((r) => buildCanonicalRow(r, defaultSourceFile));
  canonicalRows.forEach((r, idx) => {
    const parsed = TranslationRecordSchema.safeParse(r);
    if (!parsed.success) {
      errors.push(
        `Row ${idx + 2}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      );
      return;
    }
 
    const base = parsed.data;
    const computedStatus: I18nStatus = base.context_usage?.trim() ? "active" : "unused";
    rows.push({
      ...base,
      status: base.status ?? computedStatus,
    });
  });
 
  return { rows, errors };
}
 
export async function importTranslations(opts: {
  rows: TranslationRecord[];
  replaceAll?: boolean;
}): Promise<{ upserted: number; modified: number; inserted: number }> {
  const col = await getCollection();
 
  if (opts.replaceAll) {
    await col.deleteMany({});
  }
 
  const now = new Date();
  const ops = opts.rows.map((r) => ({
    updateOne: {
      filter: { namespace: r.namespace, key: r.key },
      update: {
        $set: {
          key: r.key,
          namespace: r.namespace,
          source_file: r.source_file,
          context_usage: r.context_usage ?? "",
          en: r.en ?? "",
          de: r.de ?? "",
          fr: r.fr ?? "",
          it: r.it ?? "",
          status: r.status ?? ((r.context_usage ?? "").trim() ? "active" : "unused"),
          updatedAt: now,
          ...(typeof r.reviewed === "boolean"
            ? { reviewed: r.reviewed, reviewedAt: r.reviewed ? now : null }
            : {}),
        },
        $setOnInsert: { createdAt: now, reviewed: false },
      },
      upsert: true,
    },
  }));
 
  if (ops.length === 0) return { upserted: 0, modified: 0, inserted: 0 };
 
  const res = await col.bulkWrite(ops, { ordered: false });
  return {
    upserted: res.upsertedCount ?? 0,
    modified: res.modifiedCount ?? 0,
    inserted: res.insertedCount ?? 0,
  };
}
 
export async function listTranslations(opts: {
  q?: string;
  namespace?: string;
  status?: I18nStatus;
  reviewed?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; rows: TranslationRecord[] }> {
  const col = await getCollection();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
  const offset = Math.max(opts.offset ?? 0, 0);
 
  const filter = buildTranslationsFilter(opts);
  const [total, rows] = await Promise.all([
    col.countDocuments(filter),
    col
      .find(filter, { projection: { _id: 0 } })
      .sort({ namespace: 1, key: 1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
  ]);
 
  return { total, rows };
}

export async function findRowKeysByFilter(opts: {
  q?: string;
  namespace?: string;
  status?: I18nStatus;
  reviewed?: boolean;
  limit?: number;
  excludeRowKeys?: string[];
}): Promise<string[]> {
  const col = await getCollection();
  const limit = Math.min(Math.max(opts.limit ?? 5000, 1), 5000);
  const filter = buildTranslationsFilter(opts);
  const docs = await col
    .find(filter, { projection: { _id: 0, namespace: 1, key: 1 } as any })
    .sort({ namespace: 1, key: 1 })
    .limit(limit)
    .toArray();

  return docs.map((d) => toRowKey(d as any));
}

export async function getTranslationsByRowKeys(rowKeys: string[]): Promise<TranslationRecord[]> {
  const col = await getCollection();
  const pairs = rowKeys
    .map((rk) => parseRowKey(rk))
    .filter(Boolean) as Array<{ namespace: string; key: string }>;

  if (!pairs.length) return [];

  const or = pairs.map((p) => ({ namespace: p.namespace, key: p.key }));
  return col
    .find({ $or: or }, { projection: { _id: 0 } })
    .sort({ namespace: 1, key: 1 })
    .toArray();
}

export async function bulkUpdateTranslations(updates: Array<{ rowKey: string; proposed: Partial<Pick<TranslationRecord, "en" | "de" | "fr" | "it">> }>) {
  const col = await getCollection();
  const now = new Date();

  const ops = updates
    .map((u) => {
      const parsed = parseRowKey(u.rowKey);
      if (!parsed) return null;
      const $set: Record<string, unknown> = { updatedAt: now, reviewed: true, reviewedAt: now };
      for (const k of ["en", "de", "fr", "it"] as const) {
        const v = u.proposed[k];
        if (typeof v === "string") $set[k] = v;
      }
      return {
        updateOne: {
          filter: { namespace: parsed.namespace, key: parsed.key },
          update: { $set },
        },
      };
    })
    .filter(Boolean) as any[];

  if (!ops.length) return { matched: 0, modified: 0 };
  const res = await col.bulkWrite(ops, { ordered: false });
  return { matched: res.matchedCount ?? 0, modified: res.modifiedCount ?? 0 };
}
 
function extractPlaceholders(s: string): string[] {
  // ICU-like placeholders: {name}. Ignore double braces "{{name}}" which is often templating.
  const singleBrace = /\{([^}]+)\}/g;
  const doubleBrace = /\{\{([^}]+)\}\}/g;
  if (doubleBrace.test(s)) {
    // leave it to the check function to flag
  }
  return (s.match(singleBrace) || []).sort();
}
 
export async function runDbChecks(opts?: {
  limit?: number;
  fixStatusFromContextUsage?: boolean;
}): Promise<{
  verify: string[];
  placeholders: string[];
  qa: string[];
  status: string[];
}> {
  const col = await getCollection();
  const limit = Math.min(Math.max(opts?.limit ?? 5000, 1), 20000);
  const rows = await col
    .find({}, { projection: { _id: 0 } })
    .sort({ namespace: 1, key: 1 })
    .limit(limit)
    .toArray();
 
  const verify: string[] = [];
  const placeholders: string[] = [];
  const qa: string[] = [];
  const status: string[] = [];
 
  const toFix: Array<{ namespace: string; key: string; status: I18nStatus }> = [];
 
  for (const r of rows) {
    const id = `${r.namespace}.${r.key}`;
 
    if (!r.namespace?.trim()) verify.push(`Missing namespace: ${id}`);
    if (!r.key?.trim()) verify.push(`Missing key: ${id}`);
    if (!r.source_file?.trim()) verify.push(`Missing source_file: ${id}`);
 
    // "Verify structure": missing/empty values + residue prefixes
    const locales: Array<keyof TranslationRecord> = ["en", "de", "fr", "it"];
    for (const loc of locales) {
      const v = (r[loc] ?? "") as string;
      if (!v || v.trim() === "") verify.push(`Empty value: ${id} [${loc}]`);
      if (v.includes("FR:") || v.includes("EN:") || v.includes("DE:") || v.includes("IT:")) {
        verify.push(`Placeholder residue: ${id} [${loc}] contains "LOCALE:" prefix`);
      }
    }
 
    // Placeholder check: compare placeholders vs EN
    const en = (r.en ?? "") as string;
    const enVars = extractPlaceholders(en);
    for (const loc of ["de", "fr", "it"] as const) {
      const val = (r[loc] ?? "") as string;
      if (!val) continue;
      const doubleBrace = /\{\{([^}]+)\}\}/g;
      if (doubleBrace.test(val)) {
        placeholders.push(`Incorrect format ({{ }}): ${id} [${loc}]`);
      }
      const locVars = extractPlaceholders(val);
      if (JSON.stringify(enVars) !== JSON.stringify(locVars)) {
        placeholders.push(
          `Interpolation mismatch: ${id} [${loc}] expected ${enVars.join(", ") || "(none)"} but got ${
            locVars.join(", ") || "(none)"
          }`
        );
      }
    }
 
    // QA checks
    for (const loc of ["en", "de", "fr", "it"] as const) {
      const val = (r[loc] ?? "") as string;
      if (!val) continue;
      if (val.includes("TODO") || val.includes("FIXME") || val.includes("TBD")) {
        qa.push(`QA Flag: ${id} [${loc}] contains TODO/FIXME/TBD`);
      }
    }
    for (const loc of ["de", "fr", "it"] as const) {
      const val = (r[loc] ?? "") as string;
      if (!val || !en) continue;
      if (val === en && en.length > 5 && !/[0-9]/.test(en)) {
        qa.push(`Value identical to EN: ${id} [${loc}]`);
      }
    }
 
    // Status check vs context_usage
    const computed: I18nStatus = (r.context_usage ?? "").trim() ? "active" : "unused";
    if (r.status && r.status !== computed) {
      status.push(`Status mismatch: ${id} status=${r.status} but computed=${computed}`);
      if (opts?.fixStatusFromContextUsage) {
        toFix.push({ namespace: r.namespace, key: r.key, status: computed });
      }
    }
  }
 
  if (opts?.fixStatusFromContextUsage && toFix.length) {
    await col.bulkWrite(
      toFix.map((x) => ({
        updateOne: {
          filter: { namespace: x.namespace, key: x.key },
          update: { $set: { status: x.status, updatedAt: new Date() } },
        },
      })),
      { ordered: false }
    );
  }
 
  return { verify, placeholders, qa, status };
}
