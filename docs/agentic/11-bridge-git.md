# Bridge & Git Operations

> Source: `packages/bridge/src/index.ts` (379 lines)

## Overview

The Bridge package provides workspace-scoped file I/O and Git operations. It wraps `simple-git` for all version control operations and enforces path security to prevent escaping the workspace scope.

## Workspace Utilities

### Path Security

```typescript
function resolveWorkspacePath(workspacePath: string, targetPath: string): string {
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(workspacePath, targetPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Path is outside workspace scope");
  }
  return resolved;
}
```

All file operations pass through this guard.

### Workspace Info

```typescript
type WorkspaceInfo = { path: string; name: string };

async function getWorkspaceInfo(workspacePath): Promise<WorkspaceInfo>
// Resolves absolute path, extracts basename as name
```

### File Operations

| Function | Purpose |
|---|---|
| `listFiles(workspace, relative, depth=2, limit=500)` | Recursive directory listing (skips `.git`, `node_modules`, `.next`, `dist`, `out`) |
| `readFile(workspace, relative)` | Read file content as UTF-8 |
| `writeFile(workspace, relative, content)` | Write file (creates parent dirs) |
| `applyFileChange(workspace, relative, content)` | Alias for `writeFile` |

## Git Operations

All Git operations use `simple-git` with the workspace path as `baseDir`.

### Status

```typescript
type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  staged: GitFileChange[];    // Files in the index
  unstaged: GitFileChange[];  // Working tree changes
};

type GitFileChange = {
  path: string;
  status: 'modified' | 'created' | 'deleted' | 'renamed' | 'untracked';
  from?: string;  // For renames
};
```

`getGitStatus()` maps git's status codes:
| Code | Status |
|---|---|
| `M` | `modified` |
| `A` | `created` |
| `D` | `deleted` |
| `R` | `renamed` |
| `?` | `untracked` |

### Diff Operations

| Function | Purpose |
|---|---|
| `gitDiff(workspace, filePath?)` | Working tree diff (handles untracked files via `--no-index /dev/null`) |
| `gitDiffStaged(workspace, filePath?)` | Staged (index) diff |
| `gitDiffNumstat(workspace)` | Line-level `{ additions, deletions }` count |

### Staging & Committing

| Function | Purpose |
|---|---|
| `gitStageFile(workspace, filePath)` | `git add <file>` |
| `gitStageAll(workspace)` | `git add .` |
| `gitUnstageFile(workspace, filePath)` | `git reset HEAD -- <file>` (fallback: `git rm --cached` for fresh repos) |
| `gitUnstageAll(workspace)` | `git reset HEAD` |
| `gitCommitAll(workspace, message)` | `git add . && git commit -m` |
| `gitCommitStaged(workspace, message)` | `git commit -m` (staged only) |

### Branch Operations

| Function | Purpose |
|---|---|
| `gitListBranches(workspace)` | List local branches |
| `gitCreateBranch(workspace, name)` | Create and checkout new branch |
| `gitCheckout(workspace, name)` | Switch to existing branch |

### Revert Operations

| Function | Purpose |
|---|---|
| `gitRevertFile(workspace, filePath)` | Discard changes (untracked: `git clean -f`, tracked: `git checkout --`) |
| `gitRevertAll(workspace)` | Discard all: `git checkout -- . && git clean -fd` |

### Remote Operations

| Function | Purpose |
|---|---|
| `gitPush(workspace, remote="origin", branch?)` | Push with `--set-upstream` |
| `gitCreatePR(workspace, title, body?, base?)` | Create PR via `gh` CLI (injection-safe `execFileSync`) |
| `gitCloneRepo(repoUrl, targetRoot?, branch?)` | Clone to `~/kletron-repos/` |

### PR Creation Security

`gitCreatePR` uses `execFileSync` (not `exec`) to prevent shell injection:
```typescript
const args = ["pr", "create", "--title", title];
if (body) args.push("--body", body);
if (base) args.push("--base", base);
args.push("--fill");
execFileSync("gh", args, { cwd: workspacePath, timeout: 30_000 });
```

## Integration Points

| Consumer | Usage |
|---|---|
| MCP Server tools | `git_log`, `git_diff`, `git_blame`, `git_grep` use bridge internally |
| Agent Graph Executor | Workspace binding via `runWithWorkspaceContext` |
| Frontend Git Panel | Status, staging, committing via API routes |
| Auto-indexing | Workspace file watching |
