import fs from "fs/promises";
import path from "path";

import { ensurePathInside, resolveRepoPath } from "./pathUtils.js";
import { readFileRange } from "./readFileRange.js";

function normalizeAction(action) {
  const value = (action || "").toString().trim().toLowerCase();
  if (!value) return "view";
  if (value === "read") return "view";
  return value;
}

export const strReplaceEditor = {
  description:
    "Compatibility shim for agents that call `str_replace_editor`. Supports read-only actions: view/read. Write/replace is intentionally not supported.",
  inputSchema: {
    type: "object",
    properties: {
      repoPath: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      path: { type: "string", description: "File path (absolute or relative to repo root)." },
      filePath: { type: "string", description: "Alias for `path`." },
      action: { type: "string", description: "view | read (read-only). Other actions return an error." },
      operation: { type: "string", description: "Alias for action (read/view)." },
      startLine: { type: "number", description: "Optional 1-based start line (inclusive) for ranged reads." },
      endLine: { type: "number", description: "Optional 1-based end line (inclusive) for ranged reads." },
      maxBytes: { type: "number", description: "Optional safety cap for full-file reads." },
    },
  },
  async run({ repoPath, path: providedPath, filePath, action, operation, startLine, endLine, maxBytes = 500_000 } = {}) {
    const root = resolveRepoPath(repoPath);
    const target = (providedPath || filePath || "").toString();
    if (!target) {
      return {
        ok: false,
        error:
          "Missing path/filePath. This tool is read-only and expects a file. If you wanted to inspect a directory, use `execute_bash` with `ls -la <dir>` or use `list_files`/`search_code`.",
      };
    }

    const normalized = normalizeAction(action || operation);
    if (normalized !== "view") {
      return {
        ok: false,
        error:
          "str_replace_editor is read-only in this MCP server. Use read_file/read_file_range/search_code/git_grep for inspection; no write/edit tools are exposed.",
      };
    }

    const resolvedFilePath = path.isAbsolute(target) ? path.resolve(target) : path.resolve(root, target);
    ensurePathInside(root, resolvedFilePath);

    try {
      const stat = await fs.stat(resolvedFilePath);
      if (stat.isDirectory()) {
        return {
          ok: false,
          error:
            "Target is a directory. Use `execute_bash` with `ls -la <dir>` (emulated) or use `list_files` with a narrower path.",
        };
      }
    } catch {
      // Let read attempts surface their own error.
    }

    if (Number.isFinite(startLine) && Number.isFinite(endLine)) {
      return await readFileRange.run({
        repoPath: root,
        filePath: path.relative(root, resolvedFilePath),
        startLine,
        endLine,
      });
    }

    const handle = await fs.open(resolvedFilePath, "r");
    try {
      const stat = await handle.stat();
      const size = Math.min(stat.size, Math.max(1_000, Math.trunc(maxBytes)));
      const buffer = Buffer.alloc(size);
      await handle.read(buffer, 0, size, 0);
      const truncated = size < stat.size;
      return {
        file: path.relative(root, resolvedFilePath),
        truncated,
        bytes: size,
        text: buffer.toString("utf-8"),
      };
    } finally {
      await handle.close();
    }
  },
};
