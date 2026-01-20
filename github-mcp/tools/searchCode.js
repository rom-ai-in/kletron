import { resolveRepoPath } from "./pathUtils.js";
import { globCached } from "./globCache.js";
import { searchFilesForMatches } from "./textSearch.js";

export const searchCode = {
  description:
    "Search for a string/regex in repository files and return file/line/snippet matches.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the folder. Optional if defaultDir is configured.",
      },
      query: { type: "string", description: "Text or regex pattern." },
      regex: { type: "boolean", description: "Interpret query as a regex." },
      caseSensitive: { type: "boolean" },
      wholeWord: { type: "boolean" },
      globs: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional glob patterns (e.g. ['**/*.ts','**/*.js']). Defaults to common source extensions.",
      },
      ignore: {
        type: "array",
        items: { type: "string" },
        description: "Optional ignore globs.",
      },
      maxResults: { type: "number", description: "Maximum matches to return." },
      maxFileSizeBytes: {
        type: "number",
        description: "Skip files larger than this size (bytes).",
      },
      contextLines: {
        type: "number",
        description: "Lines of context around each match.",
      },
      cacheTtlMs: {
        type: "number",
        description: "Cache TTL for globbing (ms).",
      },
    },
    required: ["query"],
  },
  async run({
    path: repoPathArgument,
    query,
    regex = false,
    caseSensitive = false,
    wholeWord = false,
    globs,
    ignore,
    maxResults = 200,
    maxFileSizeBytes = 512 * 1024,
    contextLines = 0,
    cacheTtlMs = 10_000,
  }) {
    const resolvedRoot = resolveRepoPath(repoPathArgument);
    const patterns =
      globs && globs.length
        ? globs
        : ["**/*.{js,jsx,ts,tsx,py,go,rs,md,json,html,css,scss,yml,yaml}"];
    const defaultIgnore = [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
    ];
    const ignored = ignore && ignore.length ? ignore : defaultIgnore;

    const files = await globCached({
      root: resolvedRoot,
      patterns,
      ignore: ignored,
      ttlMs: cacheTtlMs,
    });

    return await searchFilesForMatches({
      root: resolvedRoot,
      files,
      query,
      regex,
      caseSensitive,
      wholeWord,
      maxResults,
      maxFileSizeBytes,
      contextLines,
    });
  },
};
