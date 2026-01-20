import fs from "fs/promises";
import path from "path";
import { resolveRepoPath, ensurePathInside } from "./pathUtils.js";

export const writeFile = {
  description:
    "Write a file inside the configured repository root. Creates parent directories when needed.",
  inputSchema: {
    type: "object",
    properties: {
      repoPath: {
        type: "string",
        description: "Root path of the repository. Optional if defaultDir is configured.",
      },
      filePath: {
        type: "string",
        description: "Path relative to repo root (or absolute inside it).",
      },
      content: { type: "string", description: "File contents to write." },
      createDirs: { type: "boolean", description: "Create parent directories if missing." },
      overwrite: { type: "boolean", description: "Overwrite if file exists." },
    },
    required: ["filePath", "content"],
  },
  async run({ repoPath, filePath, content, createDirs = true, overwrite = true }) {
    const resolvedRoot = resolveRepoPath(repoPath);
    const resolvedFilePath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(resolvedRoot, filePath);

    ensurePathInside(resolvedRoot, resolvedFilePath);

    if (!overwrite) {
      try {
        await fs.access(resolvedFilePath);
        throw new Error(`File already exists: ${filePath}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }

    if (createDirs) {
      await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });
    }

    await fs.writeFile(resolvedFilePath, content, "utf-8");
    return { ok: true, filePath: path.isAbsolute(filePath) ? path.relative(resolvedRoot, resolvedFilePath) : filePath };
  },
};

