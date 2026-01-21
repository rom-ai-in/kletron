import { promises as fs } from "node:fs";
import path from "node:path";

export type PromptFileEntry = {
  name: string;
  path: string;
};

const promptRoot = path.resolve(process.cwd(), "prompts");

const isInsidePromptRoot = (candidate: string) => {
  const relative = path.relative(promptRoot, candidate);
  if (relative === "") return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

export const resolvePromptPath = (relativePath: string) => {
  const normalized = relativePath.replace(/^\/+/u, "");
  const resolved = path.resolve(promptRoot, normalized);
  if (!isInsidePromptRoot(resolved)) {
    throw new Error("Invalid prompt path.");
  }
  return resolved;
};

const shouldSkipEntry = (name: string) => name.startsWith(".");

export const listPromptDirs = async () => {
  try {
    const rootStats = await fs.stat(promptRoot);
    if (!rootStats.isDirectory()) return [] as string[];
  } catch {
    return [] as string[];
  }

  const dirs: string[] = [""];
  const walk = async (relativeDir: string) => {
    const absDir = resolvePromptPath(relativeDir);
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || shouldSkipEntry(entry.name)) continue;
      const nextRel = relativeDir
        ? path.posix.join(relativeDir, entry.name)
        : entry.name;
      dirs.push(nextRel);
      await walk(nextRel);
    }
  };

  await walk("");
  return dirs.sort((a, b) => a.localeCompare(b));
};

export const listPromptFiles = async (relativeDir: string) => {
  const absDir = resolvePromptPath(relativeDir);
  const dirStats = await fs.stat(absDir);
  if (!dirStats.isDirectory()) return [] as PromptFileEntry[];

  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && !shouldSkipEntry(entry.name))
    .map((entry) => ({
      name: entry.name,
      path: relativeDir
        ? path.posix.join(relativeDir, entry.name)
        : entry.name,
    }));

  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
};

export const readPromptFile = async (relativePath: string) => {
  const absPath = resolvePromptPath(relativePath);
  const stats = await fs.stat(absPath);
  if (!stats.isFile()) {
    throw new Error("Prompt path is not a file.");
  }
  return fs.readFile(absPath, "utf8");
};
