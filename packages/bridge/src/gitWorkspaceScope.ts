import path from "node:path";
import simpleGit from "simple-git";

/**
 * When the workspace folder is inside a larger Git repo (e.g. workspace =
 * `repo/business` while `.git` lives at `repo/`), return the repo-relative
 * prefix (`business`) so status/diff views can be scoped. Returns `null` when
 * the workspace *is* the repo root or Git is unavailable.
 */
export function gitScopePrefixFromPaths(gitRoot: string, workspacePath: string): string | null {
  const root = path.resolve(gitRoot);
  const ws = path.resolve(workspacePath);
  if (root === ws) return null;
  const sep = path.sep;
  if (!ws.startsWith(root + sep)) return null;
  const rel = path.relative(root, ws);
  if (!rel || rel === ".") return null;
  return rel.split(path.sep).join("/");
}

/** `repoRelativePath` as reported by Git (usually forward slashes). */
export function isRepoPathInGitScope(repoRelativePath: string, scopePrefix: string | null): boolean {
  if (!scopePrefix) return true;
  const f = repoRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const p = scopePrefix.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!p) return true;
  return f === p || f.startsWith(`${p}/`);
}

export async function readWorkspaceGitScopePrefix(workspacePath: string): Promise<string | null> {
  const resolved = path.resolve(workspacePath);
  const g = simpleGit({ baseDir: resolved });
  try {
    const root = path.resolve((await g.revparse(["--show-toplevel"])).trim());
    return gitScopePrefixFromPaths(root, resolved);
  } catch {
    return null;
  }
}
