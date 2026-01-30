import { resolveRepoPath } from "./pathUtils.js";
import { globCached } from "./globCache.js";
import { searchFilesForMatches } from "./textSearch.js";

const DEFAULT_GLOBS = ["**/*.{ts,tsx,js,jsx,md}"];
const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
];

export const locateUiFeature = {
  description:
    "Locate UI/UX features (e.g. dark mode toggle) by running a curated multi-query search over UI code and docs.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      queries: {
        type: "array",
        items: { type: "string" },
        description: "List of text queries or regex patterns to run.",
      },
      regex: { type: "boolean", description: "Interpret queries as regex." },
      caseSensitive: { type: "boolean" },
      globs: { type: "array", items: { type: "string" } },
      ignore: { type: "array", items: { type: "string" } },
      maxResultsPerQuery: { type: "number" },
      maxFileSizeBytes: { type: "number" },
      contextLines: { type: "number" },
      cacheTtlMs: { type: "number" },
    },
    required: ["queries"],
  },
  async run({
    path: repoPath,
    queries,
    regex = false,
    caseSensitive = false,
    globs,
    ignore,
    maxResultsPerQuery = 50,
    maxFileSizeBytes = 512 * 1024,
    contextLines = 0,
    cacheTtlMs = 10_000,
  } = {}) {
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error("queries must be a non-empty array.");
    }

    const root = resolveRepoPath(repoPath);
    const patterns = globs && globs.length ? globs : DEFAULT_GLOBS;
    const ignored = ignore && ignore.length ? ignore : DEFAULT_IGNORE;

    const files = await globCached({
      root,
      patterns,
      ignore: ignored,
      ttlMs: cacheTtlMs,
    });

    const resultsByQuery = {};
    for (const q of queries) {
      const result = await searchFilesForMatches({
        root,
        files,
        query: q,
        regex,
        caseSensitive,
        wholeWord: false,
        maxResults: maxResultsPerQuery,
        maxFileSizeBytes,
        contextLines,
      });
      resultsByQuery[q] = result;
    }

    return {
      root,
      queries,
      resultsByQuery,
    };
  },
};

