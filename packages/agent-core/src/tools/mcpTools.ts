import path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { McpClient } from "@numezis/mcp-client/client";
import { getConfig } from "@numezis/server/config";
import { getWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

const formatResult = (raw: unknown) => {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    // If any item is an object, stringify the whole array to preserve structure
    if (raw.some((item) => item && typeof item === "object")) {
      return JSON.stringify(raw, null, 2);
    }
    return raw.join("\n");
  }
  if (raw && typeof raw === "object") return JSON.stringify(raw, null, 2);
  return String(raw);
};

async function callMcpTool<TArgs extends Record<string, unknown> | undefined>(
  name: string,
  args?: TArgs
) {
  const client = await McpClient.getInstance();
  const workspaceContext = getWorkspaceContext();
  const rootDir =
    workspaceContext?.rootPath ?? (await getConfig()).workingFolder;

  const resolvedArgs = { ...args };

  // Helper to resolve a path property if it exists and is relative
  const resolveIfRelative = (key: string) => {
    // @ts-ignore
    const val = resolvedArgs[key];
    if (typeof val === 'string') {
      if (!path.isAbsolute(val)) {
        // @ts-ignore
        resolvedArgs[key] = path.resolve(rootDir, val);
      }
    } else if (val === undefined || val === null) {
      // If 'path' is explicitly undefined (or missing) and the tool expects it as context, defaulting to rootDir is often desired for 'path' arg.
      // But verify tool semantics. 'list_files' with no path lists root.
      // If we pass 'rootDir', it is effectively the same, but implicit becomes explicit.
      if (key === 'path') {
        // @ts-ignore
        resolvedArgs[key] = rootDir;
      }
    }
  };

  // Properties to attempt to resolve against the configured workspace root
  // 'path' is commonly used as "directory context" or "search scope"
  resolveIfRelative('path');

  // 'filePath' is usually a specific file target
  resolveIfRelative('filePath');

  // 'repoPath' is used by write_file
  resolveIfRelative('repoPath');

  if (name === "semantic_code_search") {
    // Ensure semantic search is scoped to the active workspace
    if (!("repoPath" in resolvedArgs) || !resolvedArgs.repoPath) {
      (resolvedArgs as Record<string, unknown>).repoPath = rootDir;
    }
  }

  return client.callTool(name, resolvedArgs);
}

const createListFilesTool = (defaultMaxDepth?: number) =>
  tool(
    async (input: { path?: string; maxDepth?: number }) => {
      const args: { path?: string; maxDepth?: number } = { ...input };
      if (
        defaultMaxDepth !== undefined &&
        (typeof args.maxDepth !== "number" || !Number.isFinite(args.maxDepth))
      ) {
        args.maxDepth = defaultMaxDepth;
      }
      const payload: Record<string, unknown> = {};
      if (args.path) payload.path = args.path;
      if (typeof args.maxDepth === "number") payload.maxDepth = Math.max(0, Math.floor(args.maxDepth));
      return formatResult(await callMcpTool("list_files", payload));
    },
    {
      name: "list_files",
      description:
        "List repository files. Optional `path` to scope (defaults to configured repo root). Supports `maxDepth` to limit recursion.",
      schema: z.object({
        path: z.string().optional(),
        maxDepth: z.number().int().nonnegative().optional(),
      }),
    }
  );

export const listFilesTool = createListFilesTool();
export { createListFilesTool };

export const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    return formatResult(await callMcpTool("read_file", { filePath }));
  },
  {
    name: "read_file",
    description: "Read a file from the repository.",
    schema: z.object({
      filePath: z.string(),
    }),
  }
);

export const readFileRangeTool = tool(
  async (input: { filePath: string; startLine: number; endLine: number }) => {
    return formatResult(
      await callMcpTool("read_file_range", {
        filePath: input.filePath,
        startLine: input.startLine,
        endLine: input.endLine,
      })
    );
  },
  {
    name: "read_file_range",
    description: "Read a line range from a file in the repository.",
    schema: z.object({
      filePath: z.string(),
      startLine: z.number().int().positive(),
      endLine: z.number().int().positive(),
    }),
  }
);

export const searchCodeTool = tool(
  async (input: {
    query: string;
    path?: string;
    maxResults?: number;
  }) => {
    return formatResult(
      await callMcpTool("search_code", {
        query: input.query,
        path: input.path,
        maxResults: input.maxResults ?? 50,
      })
    );
  },
  {
    name: "search_code",
    description: "Search repository files with a query",
    schema: z.object({
      query: z.string(),
      path: z.string().optional(),
      maxResults: z.number().int().positive().optional(),
    }),
  }
);

export const repoMetricsTool = tool(
  async ({ path }: { path?: string }) => {
    return formatResult(await callMcpTool("repo_metrics", path ? { path } : {}));
  },
  {
    name: "repo_metrics",
    description: "Compute quick repo metrics (language/file counts, sizes).",
    schema: z.object({
      path: z.string().optional(),
    }),
  }
);

export const describeStructureTool = tool(
  async ({ path }: { path?: string }) => {
    return formatResult(
      await callMcpTool("describe_structure", path ? { path } : {})
    );
  },
  {
    name: "describe_structure",
    description:
      "Summarize repository structure (packages, key folders, entrypoints).",
    schema: z.object({
      path: z.string().optional(),
    }),
  }
);

export const gitLogTool = tool(
  async (input: { path?: string; maxCount?: number; filePath?: string; ref?: string }) => {
    return formatResult(
      await callMcpTool("git_log", {
        path: input.path,
        maxCount: input.maxCount,
        filePath: input.filePath,
        ref: input.ref,
      })
    );
  },
  {
    name: "git_log",
    description: "List recent Git commits (optionally for a file).",
    schema: z.object({
      path: z.string().optional(),
      maxCount: z.number().int().positive().optional(),
      filePath: z.string().optional(),
      ref: z.string().optional(),
    }),
  }
);

export const gitDiffTool = tool(
  async (input: { path?: string; from?: string; to?: string; staged?: boolean; filePath?: string }) => {
    return formatResult(
      await callMcpTool("git_diff", {
        path: input.path,
        from: input.from,
        to: input.to,
        staged: input.staged,
        filePath: input.filePath,
      })
    );
  },
  {
    name: "git_diff",
    description: "Show Git diff between refs (optionally for a file).",
    schema: z.object({
      path: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      staged: z.boolean().optional(),
      filePath: z.string().optional(),
    }),
  }
);

export const gitBlameTool = tool(
  async (input: { path?: string; filePath: string; startLine?: number; endLine?: number }) => {
    return formatResult(
      await callMcpTool("git_blame", {
        path: input.path,
        filePath: input.filePath,
        startLine: input.startLine,
        endLine: input.endLine,
      })
    );
  },
  {
    name: "git_blame",
    description: "Show Git blame for a file (optionally range).",
    schema: z.object({
      path: z.string().optional(),
      filePath: z.string(),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
    }),
  }
);

export const gitGrepTool = tool(
  async (input: {
    path?: string;
    query: string;
    regex?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    globs?: string[];
    maxResults?: number;
  }) => {
    return formatResult(
      await callMcpTool("git_grep", {
        path: input.path,
        query: input.query,
        regex: input.regex,
        caseSensitive: input.caseSensitive,
        wholeWord: input.wholeWord,
        globs: input.globs,
        maxResults: input.maxResults,
      })
    );
  },
  {
    name: "git_grep",
    description: "Search tracked files using git grep.",
    schema: z.object({
      path: z.string().optional(),
      query: z.string(),
      regex: z.boolean().optional(),
      caseSensitive: z.boolean().optional(),
      wholeWord: z.boolean().optional(),
      globs: z.array(z.string()).optional(),
      maxResults: z.number().int().positive().optional(),
    }),
  }
);

export const todoSearchTool = tool(
  async (input: { path?: string; maxResults?: number }) => {
    return formatResult(
      await callMcpTool("todo_search", {
        path: input.path,
        maxResults: input.maxResults,
      })
    );
  },
  {
    name: "todo_search",
    description: "Find TODO/FIXME/HACK style markers across the repo.",
    schema: z.object({
      path: z.string().optional(),
      maxResults: z.number().int().positive().optional(),
    }),
  }
);

export const dependencyInfoTool = tool(
  async ({ path }: { path?: string }) => {
    return formatResult(await callMcpTool("dependency_info", path ? { path } : {}));
  },
  {
    name: "dependency_info",
    description: "Summarize dependencies, devDependencies, and scripts for npm/yarn projects.",
    schema: z.object({
      path: z.string().optional(),
    }),
  }
);

export const structuralSearchTool = tool(
  async (input: {
    path?: string;
    pattern: string;
    lang: string;
    globs?: string[];
    contextLines?: number;
    maxResults?: number;
    timeoutMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("structural_search", {
        path: input.path,
        pattern: input.pattern,
        lang: input.lang,
        globs: input.globs,
        contextLines: input.contextLines,
        maxResults: input.maxResults,
        timeoutMs: input.timeoutMs,
      })
    );
  },
  {
    name: "structural_search",
    description: "Search code structurally using ast-grep (AST pattern matching).",
    schema: z.object({
      path: z.string().optional(),
      pattern: z.string(),
      lang: z.string(),
      globs: z.array(z.string()).optional(),
      contextLines: z.number().int().nonnegative().optional(),
      maxResults: z.number().int().positive().optional(),
      timeoutMs: z.number().int().positive().optional(),
    }),
  }
);

export const symbolsListTool = tool(
  async (input: {
    path?: string;
    globs?: string[];
    query?: string;
    exportedOnly?: boolean;
    maxResults?: number;
    maxFiles?: number;
    cacheTtlMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("symbols_list", {
        path: input.path,
        globs: input.globs,
        query: input.query,
        exportedOnly: input.exportedOnly,
        maxResults: input.maxResults,
        maxFiles: input.maxFiles,
        cacheTtlMs: input.cacheTtlMs,
      })
    );
  },
  {
    name: "symbols_list",
    description: "List top-level symbols for TS/JS files (fast, AST-based).",
    schema: z.object({
      path: z.string().optional(),
      globs: z.array(z.string()).optional(),
      query: z.string().optional(),
      exportedOnly: z.boolean().optional(),
      maxResults: z.number().int().positive().optional(),
      maxFiles: z.number().int().positive().optional(),
      cacheTtlMs: z.number().int().positive().optional(),
    }),
  }
);

export const findSymbolTool = tool(
  async (input: {
    path?: string;
    query: string;
    exportedOnly?: boolean;
    maxResults?: number;
    globs?: string[];
  }) => {
    return formatResult(
      await callMcpTool("find_symbol", {
        path: input.path,
        query: input.query,
        exportedOnly: input.exportedOnly,
        maxResults: input.maxResults,
        globs: input.globs,
      })
    );
  },
  {
    name: "find_symbol",
    description: "Find symbols by name substring (delegates to symbols_list).",
    schema: z.object({
      path: z.string().optional(),
      query: z.string(),
      exportedOnly: z.boolean().optional(),
      maxResults: z.number().int().positive().optional(),
      globs: z.array(z.string()).optional(),
    }),
  }
);

export const goToDefinitionTool = tool(
  async (input: {
    path?: string;
    filePath: string;
    line: number;
    column: number;
    maxResults?: number;
    contextLines?: number;
    cacheTtlMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("go_to_definition", {
        path: input.path,
        filePath: input.filePath,
        line: input.line,
        column: input.column,
        maxResults: input.maxResults,
        contextLines: input.contextLines,
        cacheTtlMs: input.cacheTtlMs,
      })
    );
  },
  {
    name: "go_to_definition",
    description: "Go to definition for a TS/JS identifier at a given file/line/column.",
    schema: z.object({
      path: z.string().optional(),
      filePath: z.string(),
      line: z.number().int().positive(),
      column: z.number().int().positive(),
      maxResults: z.number().int().positive().optional(),
      contextLines: z.number().int().nonnegative().optional(),
      cacheTtlMs: z.number().int().positive().optional(),
    }),
  }
);

export const referencesTool = tool(
  async (input: {
    path?: string;
    filePath: string;
    line: number;
    column: number;
    maxResults?: number;
    contextLines?: number;
    cacheTtlMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("references", {
        path: input.path,
        filePath: input.filePath,
        line: input.line,
        column: input.column,
        maxResults: input.maxResults,
        contextLines: input.contextLines,
        cacheTtlMs: input.cacheTtlMs,
      })
    );
  },
  {
    name: "references",
    description: "Find references for a TS/JS identifier at a given file/line/column.",
    schema: z.object({
      path: z.string().optional(),
      filePath: z.string(),
      line: z.number().int().positive(),
      column: z.number().int().positive(),
      maxResults: z.number().int().positive().optional(),
      contextLines: z.number().int().nonnegative().optional(),
      cacheTtlMs: z.number().int().positive().optional(),
    }),
  }
);

export const findReferencesTool = tool(
  async (input: {
    path?: string;
    filePath: string;
    line: number;
    column: number;
    maxResults?: number;
    contextLines?: number;
    cacheTtlMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("references", {
        path: input.path,
        filePath: input.filePath,
        line: input.line,
        column: input.column,
        maxResults: input.maxResults,
        contextLines: input.contextLines,
        cacheTtlMs: input.cacheTtlMs,
      })
    );
  },
  {
    name: "find_references",
    description: "Alias of references: find references for a TS/JS identifier at a given file/line/column.",
    schema: z.object({
      path: z.string().optional(),
      filePath: z.string(),
      line: z.number().int().positive(),
      column: z.number().int().positive(),
      maxResults: z.number().int().positive().optional(),
      contextLines: z.number().int().nonnegative().optional(),
      cacheTtlMs: z.number().int().positive().optional(),
    }),
  }
);

export const webSearchTool = tool(
  async (input: {
    query: string;
    maxResults?: number;
    searchDepth?: string;
    includeAnswer?: boolean;
    includeRawContent?: boolean;
    includeImages?: boolean;
    timeoutMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("web_search", {
        query: input.query,
        maxResults: input.maxResults,
        searchDepth: input.searchDepth,
        includeAnswer: input.includeAnswer,
        includeRawContent: input.includeRawContent,
        includeImages: input.includeImages,
        timeoutMs: input.timeoutMs,
      })
    );
  },
  {
    name: "web_search",
    description: "Search the web via Tavily API.",
    schema: z.object({
      query: z.string(),
      maxResults: z.number().int().positive().optional(),
      searchDepth: z.string().optional(),
      includeAnswer: z.boolean().optional(),
      includeRawContent: z.boolean().optional(),
      includeImages: z.boolean().optional(),
      timeoutMs: z.number().int().positive().optional(),
    }),
  }
);

export const fetchUrlTool = tool(
  async (input: {
    url: string;
    timeoutMs?: number;
    maxBytes?: number;
    allowlist?: string[];
  }) => {
    return formatResult(
      await callMcpTool("fetch_url", {
        url: input.url,
        timeoutMs: input.timeoutMs,
        maxBytes: input.maxBytes,
        allowlist: input.allowlist,
      })
    );
  },
  {
    name: "fetch_url",
    description: "Fetch a URL (HTTPS only) with an allowlist.",
    schema: z.object({
      url: z.string(),
      timeoutMs: z.number().int().positive().optional(),
      maxBytes: z.number().int().positive().optional(),
      allowlist: z.array(z.string()).optional(),
    }),
  }
);

export const githubApiTool = tool(
  async (input: {
    repoUrl?: string;
    owner?: string;
    repo?: string;
    resource: string;
    state?: string;
    perPage?: number;
    page?: number;
    timeoutMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("github_api", {
        repoUrl: input.repoUrl,
        owner: input.owner,
        repo: input.repo,
        resource: input.resource,
        state: input.state,
        perPage: input.perPage,
        page: input.page,
        timeoutMs: input.timeoutMs,
      })
    );
  },
  {
    name: "github_api",
    description: "Query GitHub REST API for issues, PRs, or releases.",
    schema: z.object({
      repoUrl: z.string().optional(),
      owner: z.string().optional(),
      repo: z.string().optional(),
      resource: z.string(),
      state: z.string().optional(),
      perPage: z.number().int().positive().optional(),
      page: z.number().int().positive().optional(),
      timeoutMs: z.number().int().positive().optional(),
    }),
  }
);

export const bootstrapContextTool = tool(
  async (input: {
    path?: string;
    candidates?: string[];
    maxFiles?: number;
    maxBytesPerFile?: number;
  }) => {
    return formatResult(
      await callMcpTool("bootstrap_context", {
        path: input.path,
        candidates: input.candidates,
        maxFiles: input.maxFiles,
        maxBytesPerFile: input.maxBytesPerFile,
      })
    );
  },
  {
    name: "bootstrap_context",
    description: "Load high-signal project context files for quick grounding.",
    schema: z.object({
      path: z.string().optional(),
      candidates: z.array(z.string()).optional(),
      maxFiles: z.number().int().positive().optional(),
      maxBytesPerFile: z.number().int().positive().optional(),
    }),
  }
);

export const locateUiFeatureTool = tool(
  async (input: {
    path?: string;
    queries: string[];
    regex?: boolean;
    caseSensitive?: boolean;
    globs?: string[];
    ignore?: string[];
    maxResultsPerQuery?: number;
    maxFileSizeBytes?: number;
    contextLines?: number;
    cacheTtlMs?: number;
  }) => {
    return formatResult(
      await callMcpTool("locate_ui_feature", {
        path: input.path,
        queries: input.queries,
        regex: input.regex,
        caseSensitive: input.caseSensitive,
        globs: input.globs,
        ignore: input.ignore,
        maxResultsPerQuery: input.maxResultsPerQuery,
        maxFileSizeBytes: input.maxFileSizeBytes,
        contextLines: input.contextLines,
        cacheTtlMs: input.cacheTtlMs,
      })
    );
  },
  {
    name: "locate_ui_feature",
    description: "Locate UI/UX features via a curated multi-query search.",
    schema: z.object({
      path: z.string().optional(),
      queries: z.array(z.string()),
      regex: z.boolean().optional(),
      caseSensitive: z.boolean().optional(),
      globs: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      maxResultsPerQuery: z.number().int().positive().optional(),
      maxFileSizeBytes: z.number().int().positive().optional(),
      contextLines: z.number().int().nonnegative().optional(),
      cacheTtlMs: z.number().int().positive().optional(),
    }),
  }
);

export const writeFileTool = tool(
  async (input: {
    filePath: string;
    content: string;
    repoPath?: string;
    createDirs?: boolean;
    overwrite?: boolean;
  }) => {
    return formatResult(
      await callMcpTool("write_file", {
        repoPath: input.repoPath,
        filePath: input.filePath,
        content: input.content,
        createDirs: input.createDirs ?? true,
        overwrite: input.overwrite ?? true,
      })
    );
  },
  {
    name: "write_file",
    description: "Write a file inside the configured repository root.",
    schema: z.object({
      repoPath: z.string().optional(),
      filePath: z.string(),
      content: z.string(),
      createDirs: z.boolean().optional(),
      overwrite: z.boolean().optional(),
    }),
  }
);

export const strReplaceEditorTool = tool(
  async (input: {
    repoPath?: string;
    path?: string;
    filePath?: string;
    action?: string;
    operation?: string;
    startLine?: number;
    endLine?: number;
    maxBytes?: number;
  }) => {
    return formatResult(
      await callMcpTool("str_replace_editor", {
        repoPath: input.repoPath,
        path: input.path,
        filePath: input.filePath,
        action: input.action,
        operation: input.operation,
        startLine: input.startLine,
        endLine: input.endLine,
        maxBytes: input.maxBytes,
      })
    );
  },
  {
    name: "str_replace_editor",
    description: "Read-only compatibility shim for str_replace_editor.",
    schema: z.object({
      repoPath: z.string().optional(),
      path: z.string().optional(),
      filePath: z.string().optional(),
      action: z.string().optional(),
      operation: z.string().optional(),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
      maxBytes: z.number().int().positive().optional(),
    }),
  }
);

export const executeBashTool = tool(
  async (input: { path?: string; command: string; maxResults?: number }) => {
    return formatResult(
      await callMcpTool("execute_bash", {
        path: input.path,
        command: input.command,
        maxResults: input.maxResults,
      })
    );
  },
  {
    name: "execute_bash",
    description: "Safe emulation of a minimal shell subset (find/grep/rg/ls/cat).",
    schema: z.object({
      path: z.string().optional(),
      command: z.string(),
      maxResults: z.number().int().positive().optional(),
    }),
  }
);

export const outputFormatTool = tool(
  async (input: {
    mode?: string;
    evidence?: unknown;
    verifications?: unknown;
    findings?: unknown;
    recommendations?: unknown;
    nextActions?: unknown;
    text?: string;
  }) => {
    return formatResult(
      await callMcpTool("output_format", {
        mode: input.mode,
        evidence: input.evidence,
        verifications: input.verifications,
        findings: input.findings,
        recommendations: input.recommendations,
        nextActions: input.nextActions,
        text: input.text,
      })
    );
  },
  {
    name: "output_format",
    description: "Compatibility shim that normalizes output formatting payloads.",
    schema: z.object({
      mode: z.string().optional(),
      evidence: z.any().optional(),
      verifications: z.any().optional(),
      findings: z.any().optional(),
      recommendations: z.any().optional(),
      nextActions: z.any().optional(),
      text: z.string().optional(),
    }),
  }
);

import { semanticSearch } from "@numezis/server/services/vectorService";

export const semanticCodeSearchTool = tool(
  async (input: {
    query: string;
    path?: string;
    language?: string;
    maxResults?: number;
  }) => {
    const workspaceContext = getWorkspaceContext();
    const repoPath = workspaceContext?.rootPath ?? (await getConfig()).workingFolder;
    try {
      const results = await semanticSearch(input.query, {
        repoPath,
        path: input.path,
        language: input.language,
        maxResults: input.maxResults ?? 10,
      });
      return formatResult(results);
    } catch (error) {
      const fallback = await callMcpTool("search_code", {
        query: input.query,
        path: input.path,
        maxResults: input.maxResults ?? 10,
      });
      return `Semantic search unavailable, falling back to keyword search.\n${formatResult(fallback)}`;
    }
  },
  {
    name: "semantic_code_search",
    description: "Find content semantically similar to a natural language query. Use for conceptual searches in your working folder.",
    schema: z.object({
      query: z.string().describe("Natural language query describing what you are looking for"),
      path: z.string().optional().describe("Limit search to files under this relative path"),
      language: z.string().optional().describe("Filter by file type (e.g., markdown, text)"),
      maxResults: z.number().int().positive().optional().default(10).describe("Maximum number of snippets to return"),
    }),
  }
);

export const allMcpTools = [
  // File operations
  listFilesTool,
  readFileTool,
  readFileRangeTool,
  writeFileTool,
  // Research tools
  webSearchTool,
  fetchUrlTool,
  // Semantic search
  semanticCodeSearchTool,
  outputFormatTool,
  // Legacy code tools (keep for compatibility)
  searchCodeTool,
  repoMetricsTool,
  todoSearchTool,
  dependencyInfoTool,
  describeStructureTool,
  gitLogTool,
  gitDiffTool,
  gitGrepTool,
  gitBlameTool,
  structuralSearchTool,
  symbolsListTool,
  findSymbolTool,
  goToDefinitionTool,
  referencesTool,
  findReferencesTool,
  githubApiTool,
  bootstrapContextTool,
  locateUiFeatureTool,
  strReplaceEditorTool,
  executeBashTool,
];
