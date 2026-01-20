import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { McpClient } from "../mcp/client";

const formatResult = (raw: unknown) => {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("\n");
  if (raw && typeof raw === "object") return JSON.stringify(raw, null, 2);
  return String(raw);
};

async function callMcpTool<TArgs extends Record<string, unknown> | undefined>(
  name: string,
  args?: TArgs
) {
  const client = await McpClient.getInstance();
  return client.callTool(name, args ?? {});
}

export const listFilesTool = tool(
  async ({ path }: { path?: string }) => {
    return formatResult(await callMcpTool("list_files", path ? { path } : {}));
  },
  {
    name: "list_files",
    description:
      "List repository files. Optional `path` to scope (defaults to configured repo root).",
    schema: z.object({
      path: z.string().optional(),
    }),
  }
);

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
        maxResults: input.maxResults ?? 20,
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
