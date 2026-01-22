import fs from "fs/promises";
import path from "path";
import { resolveRepoPath, ensurePathInside } from "./pathUtils.js";

// Hard limits and defaults
const MAX_FILE_SIZE_BYTES = 256 * 1024; // 256KB
const BLOCKED_EXTENSIONS = [".env", ".DS_Store"];
const BLOCKED_FILENAMES = [".git", ".env", ".npmrc", "package-lock.json", "yarn.lock"];

export const writeFile = {
  description:
    "Write a file inside the configured repository root. Creates parent directories when needed. Enforces security policies (no dotfiles, size limits).",
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

    // 1. Enforce Dotfile Policy
    const basename = path.basename(resolvedFilePath);
    const relativePath = path.relative(resolvedRoot, resolvedFilePath);

    // Check for sensitive files
    if (BLOCKED_FILENAMES.includes(basename)) {
      throw new Error(`Security: Writing to sensitive file '${basename}' is blocked.`);
    }

    // Check for dotfiles (unless explicitly in allowlist - not implemented here, so strict default)
    // We allow .gitignore and other harmless ones potentially?
    // For now, consistent with plan "deny writing dotfiles by default"
    if (basename.startsWith(".") && basename !== ".gitignore" && basename !== ".npmignore") {
      throw new Error("Security: Writing to dotfiles is blocked by default.");
    }

    // Check for blocked extensions
    const ext = path.extname(resolvedFilePath);
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new Error(`Security: Writing to file type '${ext}' is blocked.`);
    }

    // 2. Enforce Size Limit
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Security: File content exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.`);
    }

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
