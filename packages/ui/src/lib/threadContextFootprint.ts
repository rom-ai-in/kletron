import type { SessionContextAssemblySlice } from "@kletron/shared";
import {
  categorizeToolName,
  countToolCategories,
  formatCategorySummary,
  normalizeToolName,
} from "./toolCategories";

export type ThreadContextFootprint = {
  toolInvocations: number;
  summaryLine: string;
  filesRead: string[];
  filesWritten: string[];
  dirsListed: string[];
  searchQueries: string[];
  networkQueries: string[];
  memoryGraphPaths: string[];
  bundleDynamicItems?: number;
  bundleSnippets?: number;
};

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

/** OpenAI / LangChain sometimes nest payload under `input` or `arguments`. */
function widenArgs(raw: Record<string, unknown>): Record<string, unknown> {
  const nested = raw.input ?? raw.arguments;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...raw, ...(nested as Record<string, unknown>) };
  }
  return raw;
}

/** Collect path-like strings from common tool arg shapes (union for dedupe). */
function primaryPathFromArgs(args: Record<string, unknown>): string {
  const a = widenArgs(args);
  const p =
    a.filePath ??
    a.path ??
    a.file_path ??
    a.AbsolutePath ??
    a.TargetFile ??
    a.target_file ??
    a.file ??
    a.directory ??
    a.DirectoryPath ??
    a.glob_pattern ??
    a.pattern ??
    a.root ??
    a.target_directory ??
    "";
  return typeof p === "string" ? p.trim() : "";
}

function extraPathsFromArgs(args: Record<string, unknown>): string[] {
  const a = widenArgs(args);
  const out: string[] = [];
  const pushStr = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  pushStr(a.filePath);
  pushStr(a.path);
  pushStr(a.file);
  const files = a.files ?? a.paths;
  if (Array.isArray(files)) {
    for (const x of files) pushStr(x);
  }
  return out;
}

function queryFromArgs(args: Record<string, unknown>): string {
  const w = widenArgs(args);
  const q = w.query ?? w.pattern ?? w.Query ?? w.url ?? w.endpoint ?? "";
  return typeof q === "string" ? q.trim().slice(0, 120) : "";
}

function addOrdered(arr: string[], seen: Set<string>, v: string) {
  const t = v.trim();
  if (!t || seen.has(t)) return;
  seen.add(t);
  arr.push(t);
}

type Toolish = {
  id?: string;
  kind?: string;
  role?: string;
  toolName?: string | null;
  toolArgs?: string | Record<string, unknown> | null;
};

/**
 * Build a compact “what built context” footprint from tool transcript rows + optional `contextAssembly`.
 * Deduplicates by `toolCallId` when present so call/result pairs count once.
 */
export function deriveThreadContextFootprint(
  events: readonly Toolish[],
  contextAssembly?: SessionContextAssemblySlice | null,
): ThreadContextFootprint {
  const byCallId = new Map<string, { name: string; args: Record<string, unknown> }>();

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const toolResult = e.kind === "tool" || e.role === "tool";
    /** Modern transcripts store the invocation on assistant rows; results are often separate `tool` rows. */
    const assistantCall = e.kind === "assistant" && Boolean(e.toolName);
    if ((!toolResult && !assistantCall) || !e.toolName) continue;
    const id = (e as { toolCallId?: string }).toolCallId || e.id || `idx-${i}`;
    const args = parseArgs(e.toolArgs);
    const prev = byCallId.get(id);
    if (!prev) {
      byCallId.set(id, { name: e.toolName, args });
    } else {
      const merged = { ...prev.args, ...args };
      byCallId.set(id, {
        name: e.toolName || prev.name,
        args: merged,
      });
    }
  }

  const toolNames = [...byCallId.values()].map((v) => v.name);
  const categoryCounts = countToolCategories(toolNames);
  const toolInvocations = byCallId.size;
  const summaryLine = formatCategorySummary(toolInvocations, categoryCounts);

  const seenFile = new Set<string>();
  const seenWrite = new Set<string>();
  const seenDir = new Set<string>();
  const seenSearch = new Set<string>();
  const seenNet = new Set<string>();

  const filesRead: string[] = [];
  const filesWritten: string[] = [];
  const dirsListed: string[] = [];
  const searchQueries: string[] = [];
  const networkQueries: string[] = [];

  for (const { name, args } of byCallId.values()) {
    const base = normalizeToolName(name);
    const path = primaryPathFromArgs(args);
    const allPaths = extraPathsFromArgs(args);
    const q = queryFromArgs(args);
    const cat = categorizeToolName(name);

    const pushReadFiles = () => {
      for (const p of allPaths.length ? allPaths : path ? [path] : []) {
        addOrdered(filesRead, seenFile, p);
      }
    };
    const pushDirs = () => {
      for (const p of allPaths.length ? allPaths : path ? [path] : []) {
        addOrdered(dirsListed, seenDir, p);
      }
    };

    if (["write_file", "write_to_file", "str_replace_editor", "edit_file", "replace_file_content"].includes(base)) {
      if (path) addOrdered(filesWritten, seenWrite, path);
      for (const p of allPaths) addOrdered(filesWritten, seenWrite, p);
    } else if (["list_files", "list_dir", "glob_files", "glob_file_search"].includes(base)) {
      pushDirs();
    } else if (["read_file", "read_file_range", "view_file", "drive_read_file"].includes(base)) {
      pushReadFiles();
    } else if (["git_log", "git_diff", "git_blame"].includes(base)) {
      pushReadFiles();
    } else if (["describe_structure", "bootstrap_context", "repo_metrics", "dependency_info"].includes(base)) {
      pushDirs();
    } else if (cat === "search") {
      if (q) addOrdered(searchQueries, seenSearch, q);
      pushReadFiles();
    } else if (cat === "read") {
      pushReadFiles();
    } else if (cat === "network") {
      if (q) addOrdered(networkQueries, seenNet, q);
    }
  }

  const mem = contextAssembly?.derivedMemorySync?.updatedPaths ?? [];
  const memoryGraphPaths: string[] = [];
  const seenM = new Set<string>();
  for (const p of mem) {
    if (typeof p === "string") addOrdered(memoryGraphPaths, seenM, p);
  }

  return {
    toolInvocations,
    summaryLine,
    filesRead,
    filesWritten,
    dirsListed,
    searchQueries,
    networkQueries,
    memoryGraphPaths,
    bundleDynamicItems: contextAssembly?.dynamicItemCount,
    bundleSnippets: contextAssembly?.dynamicSnippetCount,
  };
}

export function isThreadContextFootprintEmpty(fp: ThreadContextFootprint): boolean {
  return (
    fp.toolInvocations === 0 &&
    fp.filesRead.length === 0 &&
    fp.filesWritten.length === 0 &&
    fp.dirsListed.length === 0 &&
    fp.searchQueries.length === 0 &&
    fp.networkQueries.length === 0 &&
    fp.memoryGraphPaths.length === 0 &&
    fp.bundleDynamicItems == null &&
    fp.bundleSnippets == null
  );
}
