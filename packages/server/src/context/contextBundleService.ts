/**
 * Merges structural (graph) and semantic (vector) context for agent prompts.
 */

import path from "node:path";

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
  debug: {
    graphMs: number;
    vectorMs: number;
    vectorSkippedReason?: string;
    graphCount: number;
    vectorCount: number;
  };
};

function toAbsolutePath(repoPath: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(repoPath, filePath);
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

  return {
    graphItems,
    vectorItems,
    mergedFilePaths,
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
  let block = "\n\n## ACTIVE CONTEXT (Auto-Detected)\n";
  if (opts?.currentFile) {
    block += `- Current File: ${opts.currentFile}\n`;
  }

  if (bundle.graphItems.length > 0) {
    block += "\nStructural relevance (code map):\n";
    for (const item of bundle.graphItems) {
      const rel = (item.score * 100).toFixed(0);
      const reasonText = Array.isArray(item.reasons) ? item.reasons.join(", ") : "";
      block += `- ${item.id} (Relevance: ${rel}% - ${reasonText})\n`;
    }
  }

  if (bundle.vectorItems.length > 0) {
    block += "\nSemantic matches (vector index):\n";
    for (const v of bundle.vectorItems) {
      const sc = (v.score * 100).toFixed(0);
      const loc =
        v.startLine != null && v.endLine != null ? ` L${v.startLine}-${v.endLine}` : "";
      block += `- ${v.filePathAbs}${loc} (score ${sc}%)\n`;
    }
  }

  if (bundle.graphItems.length === 0 && bundle.vectorItems.length === 0) {
    block += "No specific relevant files detected from structural or semantic context.\n";
  }

  return block;
}
