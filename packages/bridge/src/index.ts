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

export type GitFileChange = {
  path: string;
  status: 'modified' | 'created' | 'deleted' | 'renamed' | 'untracked';
  from?: string; // original path for renames
};

export type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  /** Files staged in the index (ready to commit) */
  staged: GitFileChange[];
  /** Files with unstaged working-tree changes */
  unstaged: GitFileChange[];
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
  await fs.mkdir(path.dirname(resolved), { recursive: true });
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

  // Build staged / unstaged lists from the per-file data
  const staged: GitFileChange[] = [];
  const unstaged: GitFileChange[] = [];

  // Build a lookup map for renames: new-path → old-path
  const renameMap = new Map(status.renamed.map(r => [r.to, r.from]));

  for (const f of status.files) {
    const indexStatus = f.index;   // status in the staging area
    const wtStatus = f.working_dir; // status in the working tree

    // Staged changes (index column)
    if (indexStatus && indexStatus !== ' ' && indexStatus !== '?') {
      staged.push({
        path: f.path,
        status: indexStatus === 'M' ? 'modified'
          : indexStatus === 'A' ? 'created'
          : indexStatus === 'D' ? 'deleted'
          : indexStatus === 'R' ? 'renamed'
          : 'modified',
        ...(indexStatus === 'R' ? { from: renameMap.get(f.path) ?? f.path } : {}),
      });
    }

    // Unstaged changes (working tree column)
    if (wtStatus && wtStatus !== ' ') {
      unstaged.push({
        path: f.path,
        status: wtStatus === 'M' ? 'modified'
          : wtStatus === 'D' ? 'deleted'
          : wtStatus === '?' ? 'untracked'
          : wtStatus === 'A' ? 'created'
          : 'modified',
      });
    }
  }

  return {
    branch: status.current || "",
    ahead: status.ahead || 0,
    behind: status.behind || 0,
    modified: status.modified,
    created: status.created,
    deleted: status.deleted,
    renamed: status.renamed.map(r => ({ from: r.from, to: r.to })),
    staged,
    unstaged,
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
    // Check if the file is untracked — git diff returns nothing for untracked files
    const status = await git.status(["--", filePath]);
    const isUntracked = status.not_added.includes(filePath);
    if (isUntracked) {
      try {
        return await git.diff(["--no-index", "--", "/dev/null", filePath]);
      } catch (err: any) {
        // git diff --no-index exits with code 1 when there ARE differences (expected)
        if (err?.stdout) return err.stdout;
        if (String(err).includes("exit code 1")) return err?.message ?? "";
        throw err;
      }
    }
    return git.diff(["--", filePath]);
  }
  return git.diff();
}

/** Get diff for staged files (or a specific staged file) */
export async function gitDiffStaged(workspacePath: string, filePath?: string): Promise<string> {
  const git = getGit(workspacePath);
  if (filePath) {
    return git.diff(["--cached", "--", filePath]);
  }
  return git.diff(["--cached"]);
}

/** Stage a specific file (git add) */
export async function gitStageFile(workspacePath: string, filePath: string): Promise<void> {
  const git = getGit(workspacePath);
  await git.add(filePath);
}

/** Stage all changes (git add .) */
export async function gitStageAll(workspacePath: string): Promise<void> {
  const git = getGit(workspacePath);
  await git.add(".");
}

/** Unstage a specific file (git reset HEAD) */
export async function gitUnstageFile(workspacePath: string, filePath: string): Promise<void> {
  const git = getGit(workspacePath);
  try {
    await git.reset(["HEAD", "--", filePath]);
  } catch {
    // On a fresh repo with no commits, HEAD doesn't exist — use rm --cached
    await git.raw(["rm", "--cached", "--", filePath]);
  }
}

/** Unstage all files (git reset HEAD) */
export async function gitUnstageAll(workspacePath: string): Promise<void> {
  const git = getGit(workspacePath);
  try {
    await git.reset(["HEAD"]);
  } catch {
    // On a fresh repo with no commits, HEAD doesn't exist — use rm --cached
    await git.raw(["rm", "--cached", "-r", "."]);
  }
}

/** Revert a specific file (discard working tree changes) */
export async function gitRevertFile(workspacePath: string, filePath: string): Promise<void> {
  const git = getGit(workspacePath);
  // Check if the file is untracked — git checkout won't work for those
  const status = await git.status(["--", filePath]);
  if (status.not_added.includes(filePath)) {
    await git.clean("f", ["--", filePath]);
  } else {
    await git.checkout(["--", filePath]);
  }
}

/** Revert all working tree changes */
export async function gitRevertAll(workspacePath: string): Promise<void> {
  const git = getGit(workspacePath);
  // Discard tracked modifications
  await git.checkout(["--", "."]);
  // Also remove untracked files
  await git.clean("f", ["-d"]);
}

/** Commit only staged files (no git add .) */
export async function gitCommitStaged(workspacePath: string, message: string): Promise<string> {
  const git = getGit(workspacePath);
  const result = await git.commit(message);
  return result.commit || "";
}

/** Push to remote (defaults to origin, current branch) */
export async function gitPush(workspacePath: string, remote = "origin", branch?: string): Promise<string> {
  const git = getGit(workspacePath);
  const status = await git.status();
  const targetBranch = branch || status.current || "main";
  const result = await git.push(remote, targetBranch, ["--set-upstream"]);
  // result.pushed is an array of push details
  return `Pushed to ${remote}/${targetBranch}`;
}

/** Get line-level addition/deletion counts for all pending changes */
export type DiffNumstat = { additions: number; deletions: number };

export async function gitDiffNumstat(workspacePath: string): Promise<DiffNumstat> {
  const git = getGit(workspacePath);
  let additions = 0;
  let deletions = 0;

  // Unstaged changes
  const unstaged = await git.diff(["--numstat"]);
  // Staged changes
  const staged = await git.diff(["--cached", "--numstat"]);

  for (const line of [...unstaged.split("\n"), ...staged.split("\n")]) {
    const match = line.match(/^(\d+|-)\t(\d+|-)\t/);
    if (match) {
      if (match[1] !== "-") additions += parseInt(match[1], 10);
      if (match[2] !== "-") deletions += parseInt(match[2], 10);
    }
  }

  return { additions, deletions };
}

/** Create a PR using the `gh` CLI (must be installed and authenticated).
 *  Uses execFileSync (no shell) to prevent injection attacks. */
export async function gitCreatePR(
  workspacePath: string,
  title: string,
  body?: string,
  base?: string,
): Promise<{ url: string; number: number }> {
  const { execFileSync } = await import("node:child_process");

  // 1. Verify gh CLI is available
  try {
    execFileSync("gh", ["--version"], { encoding: "utf-8", timeout: 5_000, stdio: "pipe" });
  } catch {
    throw new Error(
      "GitHub CLI (gh) is not installed or not in PATH. " +
      "Install it from https://cli.github.com and run `gh auth login` to authenticate."
    );
  }

  // 2. Build args array — execFileSync passes each arg directly, no shell interpolation
  const args = ["pr", "create", "--title", title];
  if (body) args.push("--body", body);
  if (base) args.push("--base", base);
  args.push("--fill");

  const output = execFileSync("gh", args, {
    cwd: workspacePath,
    encoding: "utf-8",
    timeout: 30_000,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  // 3. Parse the PR URL from output — support any git host (GitHub, GitLab, Bitbucket, etc.)
  const urlMatch = output.match(/https?:\/\/[^\s]+/);
  const numberMatch = output.match(/\/pull\/(\d+)/) || output.match(/\/merge_requests\/(\d+)/);
  return {
    url: urlMatch?.[0] || output,
    number: numberMatch ? parseInt(numberMatch[1], 10) : 0,
  };
}

export async function gitCloneRepo(repoUrl: string, targetRoot?: string, branch?: string): Promise<CloneResult> {
  const root = targetRoot || path.join(os.homedir(), "kletron-repos");
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
