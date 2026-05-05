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

function pathFromArgs(args: Record<string, unknown>): string {
  const p =
    args.path ??
    args.file_path ??
    args.filePath ??
    args.AbsolutePath ??
    args.TargetFile ??
    args.directory ??
    args.DirectoryPath ??
    args.glob_pattern ??
    args.pattern ??
    args.root ??
    "";
  return typeof p === "string" ? p.trim() : "";
}

function queryFromArgs(args: Record<string, unknown>): string {
  const q = args.query ?? args.pattern ?? args.Query ?? args.url ?? args.endpoint ?? "";
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
    const isTool = e.kind === "tool" || e.role === "tool";
    if (!isTool || !e.toolName) continue;
    const id = (e as { toolCallId?: string }).toolCallId || e.id || `idx-${i}`;
    const args = parseArgs(e.toolArgs);
    const prev = byCallId.get(id);
    if (!prev) {
      byCallId.set(id, { name: e.toolName, args });
    } else {
      if (Object.keys(args).length > Object.keys(prev.args).length) {
        prev.args = args;
        prev.name = e.toolName;
      }
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
    const path = pathFromArgs(args);
    const q = queryFromArgs(args);

    if (["read_file", "read_file_range", "view_file", "drive_read_file"].includes(base)) {
      if (path) addOrdered(filesRead, seenFile, path);
    } else if (["write_file", "write_to_file", "str_replace_editor", "edit_file", "replace_file_content"].includes(base)) {
      if (path) addOrdered(filesWritten, seenWrite, path);
    } else if (["list_files", "list_dir", "glob_files", "glob_file_search"].includes(base)) {
      if (path) addOrdered(dirsListed, seenDir, path);
    } else if (categorizeToolName(name) === "search") {
      if (q) addOrdered(searchQueries, seenSearch, q);
    } else if (categorizeToolName(name) === "network") {
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
