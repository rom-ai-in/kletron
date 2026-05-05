/**
 * Merges structural (graph) and semantic (vector) context for agent prompts.
 */

import path from "node:path";
import fs from "node:fs/promises";

import type { RankedContextItem, EditorState } from "@kletron/shared/context/graph";
import type { WorkspaceContextInjectionSettings } from "@kletron/shared/workspaceContextInjection";

import type { ContextGraphStore } from "@kletron/server/context/graph/ContextGraphStore";
import { ContextRanker } from "@kletron/server/context/graph/ContextRanker";
import { countChunksForRepo, semanticSearch } from "@kletron/server/services/vectorService";

export type SemanticContextHit = {
  source: "semantic";
  filePathAbs: string;
  score: number;
  startLine?: number;
  endLine?: number;
  snippet?: string;
};

export type ContextBundleResult = {
  graphItems: RankedContextItem[];
  vectorItems: SemanticContextHit[];
  mergedFilePaths: string[];
  promptItems: PromptContextItem[];
  debug: {
    graphMs: number;
    vectorMs: number;
    vectorSkippedReason?: string;
    graphCount: number;
    vectorCount: number;
  };
};

export type PromptContextItem = {
  path: string;
  source: "structural" | "semantic" | "hybrid";
  score: number;
  reason: string;
  lineSpan?: {
    startLine?: number;
    endLine?: number;
  };
  snippet?: string;
};

export const PROMPT_CONTEXT_MAX_FILES = 6;
export const PROMPT_CONTEXT_MAX_SNIPPETS = 4;
export const PROMPT_CONTEXT_MAX_SNIPPET_CHARS = 320;
export const PROMPT_CONTEXT_TOTAL_SNIPPET_BUDGET = 2500;

function toAbsolutePath(repoPath: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(repoPath, filePath);
}

function truncateSnippet(value: string | undefined, maxChars = PROMPT_CONTEXT_MAX_SNIPPET_CHARS): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars - 1).trimEnd()}…` : cleaned;
}

async function hydrateSnippetFromFile(
  filePathAbs: string,
  lineSpan?: { startLine?: number; endLine?: number },
): Promise<string | undefined> {
  try {
    const content = await fs.readFile(filePathAbs, "utf-8");
    const lines = content.split("\n");
    if (lineSpan?.startLine && lineSpan.startLine > 0) {
      const start = Math.max(0, lineSpan.startLine - 1);
      const end = Math.max(start + 1, Math.min(lines.length, (lineSpan.endLine ?? lineSpan.startLine) + 3));
      return truncateSnippet(lines.slice(start, end).join(" "));
    }
    return truncateSnippet(lines.slice(0, 12).join(" "));
  } catch {
    return undefined;
  }
}

async function buildPromptItems(opts: {
  rootPath: string;
  graphItems: RankedContextItem[];
  vectorItems: SemanticContextHit[];
}): Promise<PromptContextItem[]> {
  const merged = new Map<string, PromptContextItem>();

  for (const item of opts.graphItems) {
    const existing = merged.get(item.id);
    const reason = Array.isArray(item.reasons) && item.reasons.length > 0
      ? item.reasons.join(", ")
      : "structural relevance";
    if (!existing) {
      merged.set(item.id, {
        path: item.id,
        source: "structural",
        score: item.score,
        reason,
      });
      continue;
    }
    existing.source = existing.source === "semantic" ? "hybrid" : existing.source;
    existing.score = Math.max(existing.score, item.score);
    existing.reason = existing.reason.includes(reason) ? existing.reason : `${existing.reason}; ${reason}`;
  }

  for (const item of opts.vectorItems) {
    const existing = merged.get(item.filePathAbs);
    const semanticReason = "semantic match";
    if (!existing) {
      merged.set(item.filePathAbs, {
        path: item.filePathAbs,
        source: "semantic",
        score: item.score,
        reason: semanticReason,
        lineSpan: {
          startLine: item.startLine,
          endLine: item.endLine,
        },
        snippet: truncateSnippet(item.snippet),
      });
      continue;
    }
    existing.source = existing.source === "structural" ? "hybrid" : existing.source;
    existing.score = Math.max(existing.score, item.score);
    existing.reason = existing.reason.includes(semanticReason)
      ? existing.reason
      : `${existing.reason}; ${semanticReason}`;
    existing.lineSpan = existing.lineSpan ?? {
      startLine: item.startLine,
      endLine: item.endLine,
    };
    existing.snippet = existing.snippet ?? truncateSnippet(item.snippet);
  }

  const ranked = Array.from(merged.values())
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, PROMPT_CONTEXT_MAX_FILES);

  let snippetCount = 0;
  let snippetBudgetRemaining = PROMPT_CONTEXT_TOTAL_SNIPPET_BUDGET;
  for (const item of ranked) {
    if (!item.snippet && snippetCount < PROMPT_CONTEXT_MAX_SNIPPETS) {
      item.snippet = await hydrateSnippetFromFile(item.path, item.lineSpan);
    }
    if (!item.snippet) continue;
    const next = truncateSnippet(item.snippet, Math.min(PROMPT_CONTEXT_MAX_SNIPPET_CHARS, snippetBudgetRemaining));
    if (!next) {
      item.snippet = undefined;
      continue;
    }
    item.snippet = next;
    snippetCount += 1;
    snippetBudgetRemaining -= next.length;
    if (snippetBudgetRemaining <= 0 || snippetCount >= PROMPT_CONTEXT_MAX_SNIPPETS) {
      snippetBudgetRemaining = 0;
    }
  }

  return ranked;
}

export async function buildContextBundle(opts: {
  rootPath: string;
  userPrompt: string;
  editorState: EditorState;
  store: ContextGraphStore;
  settings: WorkspaceContextInjectionSettings;
}): Promise<ContextBundleResult> {
  const { rootPath, userPrompt, editorState, store, settings } = opts;

  let graphMs = 0;
  let vectorMs = 0;
  const graphItems: RankedContextItem[] = [];
  const vectorItems: SemanticContextHit[] = [];
  let vectorSkippedReason: string | undefined;

  if (settings.structuralInjectionEnabled) {
    const t0 = Date.now();
    const ranker = new ContextRanker(store);
    const ranked = await ranker.rank({
      userPrompt,
      editorState,
      limit: settings.graphTopN,
      tokenBudget: settings.tokenBudget,
    });
    graphItems.push(...ranked);
    graphMs = Date.now() - t0;
  }

  if (settings.semanticInjectionEnabled && userPrompt.trim().length > 0) {
    const t0 = Date.now();
    try {
      const chunkCount = await countChunksForRepo(rootPath);
      if (chunkCount === 0) {
        vectorSkippedReason = "empty_index";
      } else {
        const raw = await semanticSearch(userPrompt, {
          repoPath: rootPath,
          maxResults: settings.vectorTopN,
        });
        for (const row of raw) {
          const fp = String((row as { filePath?: string }).filePath ?? "");
          if (!fp) continue;
          const abs = toAbsolutePath(rootPath, fp);
          vectorItems.push({
            source: "semantic",
            filePathAbs: abs,
            score: typeof (row as { score?: number }).score === "number" ? (row as { score: number }).score : 0,
            startLine: (row as { startLine?: number }).startLine,
            endLine: (row as { endLine?: number }).endLine,
            snippet:
              typeof (row as { content?: string }).content === "string"
                ? String((row as { content: string }).content).slice(0, 400)
                : undefined,
          });
        }
      }
    } catch (err) {
      vectorSkippedReason = (err as Error)?.message || "semantic_search_failed";
    }
    vectorMs = Date.now() - t0;
  } else if (settings.semanticInjectionEnabled) {
    vectorSkippedReason = "empty_prompt";
  }

  const seen = new Set<string>();
  const mergedFilePaths: string[] = [];

  for (const g of graphItems) {
    if (!seen.has(g.id)) {
      seen.add(g.id);
      mergedFilePaths.push(g.id);
    }
  }
  for (const v of vectorItems) {
    if (!seen.has(v.filePathAbs)) {
      seen.add(v.filePathAbs);
      mergedFilePaths.push(v.filePathAbs);
    }
  }

  console.log(
    `[ContextBundle] graph=${graphItems.length} vector=${vectorItems.length} merged=${mergedFilePaths.length} ` +
      `graphMs=${graphMs} vectorMs=${vectorMs} skip=${vectorSkippedReason ?? "none"}`
  );

  const promptItems = await buildPromptItems({
    rootPath,
    graphItems,
    vectorItems,
  });

  return {
    graphItems,
    vectorItems,
    mergedFilePaths,
    promptItems,
    debug: {
      graphMs,
      vectorMs,
      vectorSkippedReason,
      graphCount: graphItems.length,
      vectorCount: vectorItems.length,
    },
  };
}

export function formatContextBundleForPrompt(
  bundle: ContextBundleResult,
  opts?: { currentFile?: string | null }
): string {
  let block = "\n\n## DYNAMIC CONTEXT\n";
  if (opts?.currentFile) {
    block += `- Current File: ${opts.currentFile}\n`;
  }

  if (bundle.promptItems.length > 0) {
    block += "\nTop relevant files:\n";
    for (const item of bundle.promptItems) {
      const rel = `${Math.round(item.score * 100)}%`;
      const loc =
        item.lineSpan?.startLine != null
          ? ` lines ${item.lineSpan.startLine}-${item.lineSpan.endLine ?? item.lineSpan.startLine}`
          : "";
      block += `- ${item.path}${loc} [${item.source}, ${rel}] — ${item.reason}\n`;
      if (item.snippet) {
        block += `  Snippet: ${item.snippet}\n`;
      }
    }
  } else {
    block += "No specific relevant files detected from structural or semantic context.\n";
  }

  return block;
}
