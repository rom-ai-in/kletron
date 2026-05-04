import { glob } from "glob";
import { resolveRepoPath } from "./pathUtils.js";

const DEFAULT_IGNORE = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"];
const DEFAULT_MAX = 500;
const ABS_MAX = 2000;

export const globFiles = {
    description:
        "Find file paths matching a glob pattern under the workspace root (Claude-style file discovery). Returns paths relative to the search directory.",
    inputSchema: {
        type: "object",
        properties: {
            pattern: {
                type: "string",
                description: 'Glob pattern (e.g. "**/*.ts", "src/**/*.tsx").',
            },
            cwd: {
                type: "string",
                description: "Optional subdirectory relative to repo root; defaults to workspace root.",
            },
            ignore: {
                type: "array",
                items: { type: "string" },
                description: "Additional ignore glob patterns (merged with defaults).",
            },
            maxResults: {
                type: "number",
                description: `Maximum paths to return (default ${DEFAULT_MAX}, hard cap ${ABS_MAX}).`,
            },
        },
        required: ["pattern"],
    },
    async run({ pattern, cwd, ignore, maxResults } = {}) {
        const p = typeof pattern === "string" ? pattern.trim() : "";
        if (!p) throw new Error("glob_files requires a non-empty pattern");

        const root = resolveRepoPath(typeof cwd === "string" && cwd.trim() ? cwd.trim() : undefined);
        const extra = Array.isArray(ignore) ? ignore.filter((x) => typeof x === "string") : [];
        const capRaw = Number(maxResults);
        const cap = Number.isFinite(capRaw)
            ? Math.min(ABS_MAX, Math.max(1, Math.floor(capRaw)))
            : DEFAULT_MAX;

        const files = await glob(p, {
            cwd: root,
            nodir: true,
            ignore: [...DEFAULT_IGNORE, ...extra],
        });

        if (files.length > cap) {
            return {
                files: files.slice(0, cap),
                truncated: true,
                totalMatched: files.length,
            };
        }
        return { files, truncated: false, totalMatched: files.length };
    },
};
