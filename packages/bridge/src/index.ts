import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import simpleGit, { type SimpleGit } from "simple-git";

export type WorkspaceInfo = {
  path: string;
  name: string;
};

export type FileEntry = {
  path: string;
  name: string;
  isDirectory: boolean;
};

export type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
};

export function getWorkspaceName(workspacePath: string): string {
  const cleaned = workspacePath.replace(/\/+$/, "");
  return path.basename(cleaned) || cleaned;
}

export function resolveWorkspacePath(workspacePath: string, targetPath: string): string {
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(workspacePath, targetPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Path is outside workspace scope");
  }
  return resolved;
}

export async function getWorkspaceInfo(workspacePath: string): Promise<WorkspaceInfo> {
  const resolved = path.resolve(workspacePath);
  if (!fsSync.existsSync(resolved)) {
    throw new Error("Workspace path does not exist");
  }
  return {
    path: resolved,
    name: getWorkspaceName(resolved)
  };
}

export async function listFiles(workspacePath: string, relativePath = "", depth = 2, limit = 500): Promise<FileEntry[]> {
  const resolved = resolveWorkspacePath(workspacePath, relativePath);
  if (depth < 0) return [];

  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const results: FileEntry[] = [];

  for (const entry of entries) {
    if (results.length >= limit) break;
    if ([".git", "node_modules", ".next", "dist", "out"].includes(entry.name)) {
      continue;
    }
    const entryRelative = path.join(relativePath, entry.name);
    results.push({
      path: entryRelative,
      name: entry.name,
      isDirectory: entry.isDirectory()
    });

    if (entry.isDirectory() && depth > 0) {
      const children = await listFiles(workspacePath, entryRelative, depth - 1, limit - results.length);
      results.push(...children);
    }
  }

  return results;
}

export async function readFile(workspacePath: string, relativePath: string): Promise<string> {
  const resolved = resolveWorkspacePath(workspacePath, relativePath);
  return fs.readFile(resolved, "utf-8");
}

export async function writeFile(workspacePath: string, relativePath: string, content: string): Promise<void> {
  const resolved = resolveWorkspacePath(workspacePath, relativePath);
  await fs.writeFile(resolved, content, "utf-8");
}

export async function applyFileChange(workspacePath: string, relativePath: string, newContent: string): Promise<void> {
  await writeFile(workspacePath, relativePath, newContent);
}

function getGit(repoPath: string): SimpleGit {
  return simpleGit({ baseDir: repoPath });
}

export async function getGitStatus(workspacePath: string): Promise<GitStatus> {
  const git = getGit(workspacePath);
  const status = await git.status();
  return {
    branch: status.current || "",
    ahead: status.ahead || 0,
    behind: status.behind || 0,
    modified: status.modified,
    created: status.created,
    deleted: status.deleted,
    renamed: status.renamed.map(r => ({ from: r.from, to: r.to }))
  };
}

export async function gitCommitAll(workspacePath: string, message: string): Promise<string> {
  const git = getGit(workspacePath);
  await git.add(".");
  const result = await git.commit(message);
  return result.commit || "";
}

export async function gitCreateBranch(workspacePath: string, branchName: string): Promise<void> {
  const git = getGit(workspacePath);
  await git.checkoutLocalBranch(branchName);
}

export async function gitCheckout(workspacePath: string, branchName: string): Promise<void> {
  const git = getGit(workspacePath);
  await git.checkout(branchName);
}

export type CloneResult = {
  repoPath: string;
  workspace: WorkspaceInfo;
};

export async function gitListBranches(workspacePath: string): Promise<string[]> {
  const git = getGit(workspacePath);
  const result = await git.branchLocal();
  return result.all;
}

export async function gitDiff(workspacePath: string, filePath?: string): Promise<string> {
  const git = getGit(workspacePath);
  if (filePath) {
    return git.diff(["--", filePath]);
  }
  return git.diff();
}

export async function gitCloneRepo(repoUrl: string, targetRoot?: string, branch?: string): Promise<CloneResult> {
  const root = targetRoot || path.join(os.homedir(), "numezis-repos");
  const repoName = repoUrl.split("/").pop()?.replace(/\.git$/i, "") || "repo";
  const repoPath = path.join(root, repoName);

  await fs.mkdir(root, { recursive: true });

  if (!fsSync.existsSync(repoPath)) {
    const git = simpleGit();
    const args: string[] = [];
    if (branch) {
      args.push("--branch", branch, "--single-branch");
    }
    await git.clone(repoUrl, repoPath, args);
  }

  const workspace = await getWorkspaceInfo(repoPath);
  return { repoPath, workspace };
}
