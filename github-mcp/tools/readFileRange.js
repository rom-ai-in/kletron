import fs from "fs/promises";
import path from "path";
import { ensurePathInside, resolveRepoPath } from "./pathUtils.js";

function clampLine(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export const readFileRange = {
  description:
    "Read a specific line range from a file in a repository (1-based inclusive).",
  inputSchema: {
    type: "object",
    properties: {
      repoPath: {
        type: "string",
        description: "Root path of the repository. Optional if defaultDir is configured.",
      },
      filePath: { type: "string", description: "Path relative to repo root (or absolute inside it)." },
      startLine: { type: "number", description: "1-based start line (inclusive)." },
      endLine: { type: "number", description: "1-based end line (inclusive)." },
      maxLines: { type: "number", description: "Safety cap for returned lines." },
    },
    required: ["filePath", "startLine", "endLine"],
  },
  async run({ repoPath, filePath, startLine, endLine, maxLines = 500 }) {
    const resolvedRoot = resolveRepoPath(repoPath);
    const resolvedFilePath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(resolvedRoot, filePath);

    ensurePathInside(resolvedRoot, resolvedFilePath);

    const content = await fs.readFile(resolvedFilePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    const start = clampLine(startLine, 1, totalLines);
    const end = clampLine(endLine, start, totalLines);
    const cappedEnd = Math.min(end, start + maxLines - 1);

    const text = lines.slice(start - 1, cappedEnd).join("\n");
    return {
      file: path.isAbsolute(filePath) ? path.relative(resolvedRoot, resolvedFilePath) : filePath,
      startLine: start,
      endLine: cappedEnd,
      totalLines,
      truncated: cappedEnd < end,
      text,
    };
  },
};

