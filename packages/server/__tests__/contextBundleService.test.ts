import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@kletron/server/services/vectorService", () => ({
  countChunksForRepo: vi.fn(() => Promise.resolve(3)),
  semanticSearch: vi.fn(() =>
    Promise.resolve([
      {
        filePath: "other.ts",
        repoPath: "/w",
        score: 0.42,
        startLine: 1,
        endLine: 5,
        content: "// x",
      },
    ])
  ),
}));

import type { EditorState } from "@kletron/shared/context/graph";
import { DEFAULT_WORKSPACE_CONTEXT_INJECTION } from "@kletron/shared/workspaceContextInjection";
import { ContextGraphStore } from "@kletron/server/context/graph/ContextGraphStore";
import {
  buildContextBundle,
  formatContextBundleForPrompt,
} from "@kletron/server/context/contextBundleService";
import { countChunksForRepo, semanticSearch } from "@kletron/server/services/vectorService";

describe("contextBundleService", () => {
  beforeEach(() => {
    vi.mocked(countChunksForRepo).mockResolvedValue(3);
    vi.mocked(semanticSearch).mockResolvedValue([
      {
        filePath: "other.ts",
        repoPath: "/w",
        score: 0.42,
        startLine: 1,
        endLine: 5,
        content: "// x",
      },
    ]);
  });

  it("merges graph and vector hits and dedupes by absolute path", async () => {
    const store = new ContextGraphStore("/w");
    store.addNode({
      id: "/w/other.ts",
      type: "file",
      label: "other.ts",
      metadata: { name: "other.ts", path: "other.ts", language: "typescript" },
      stats: { size: 100, lineCount: 20, tokenEstimate: 5 },
    });

    const editorState: EditorState = {
      openFiles: [],
      recentEdits: [],
      visibleRanges: [],
    };

    const bundle = await buildContextBundle({
      rootPath: "/w",
      userPrompt: "fix other.ts bug",
      editorState,
      store,
      settings: {
        ...DEFAULT_WORKSPACE_CONTEXT_INJECTION,
        structuralInjectionEnabled: true,
        semanticInjectionEnabled: true,
        graphTopN: 10,
        vectorTopN: 5,
        tokenBudget: 50000,
        requireVectorIndexForAgent: false,
      },
    });

    expect(bundle.mergedFilePaths).toContain("/w/other.ts");
    expect(bundle.debug.graphCount).toBeGreaterThanOrEqual(0);
    expect(bundle.debug.vectorCount).toBe(1);

    const prompt = formatContextBundleForPrompt(bundle, { currentFile: "/w/foo.ts" });
    expect(prompt).toContain("ACTIVE CONTEXT");
    expect(prompt).toContain("/w/other.ts");
  });

  it("skips semantic branch when disabled", async () => {
    const store = new ContextGraphStore("/w");
    const bundle = await buildContextBundle({
      rootPath: "/w",
      userPrompt: "hello",
      editorState: { openFiles: [], recentEdits: [], visibleRanges: [] },
      store,
      settings: {
        ...DEFAULT_WORKSPACE_CONTEXT_INJECTION,
        structuralInjectionEnabled: false,
        semanticInjectionEnabled: false,
      },
    });
    expect(bundle.graphItems).toHaveLength(0);
    expect(bundle.vectorItems).toHaveLength(0);
    expect(vi.mocked(semanticSearch).mock.calls.length).toBe(0);
  });
});
