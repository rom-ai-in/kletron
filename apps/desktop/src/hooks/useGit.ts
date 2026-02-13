import { useCallback, useEffect, useRef, useState } from "react";
import type { GitStatusInfo } from "../types";

/**
 * Central hook for all Git operations.
 *
 * Uses a **generation counter** (`genRef`) to prevent stale async results from
 * a previous workspace being written into the state of the current one.
 *
 * Every time `workspacePath` changes the generation increments and all pending
 * async operations from the old workspace are silently discarded.
 *
 * Additionally, every IPC call passes the captured `workspacePath` explicitly
 * so the Electron main process always runs the command against the intended
 * repository — even if `currentWorkspacePath` has already been updated by a
 * concurrent workspace switch.
 */
export function useGit(
  workspacePath: string | null,
  backendUrlTrimmed: string,
  getAccessToken: () => Promise<string | null>
) {
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [selectedDiffContent, setSelectedDiffContent] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [allDiffs, setAllDiffs] = useState<Map<string, string | null>>(new Map());
  const [allDiffsLoading, setAllDiffsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Generation counter — incremented on every workspace switch ────────────
  const genRef = useRef(0);

  /** Return the current generation. Callers capture this before an async op
   *  and compare afterwards to detect staleness. */
  const gen = () => genRef.current;

  // Keep a ref to workspacePath so async closures can read it without stale closure issues
  const cwdRef = useRef(workspacePath);
  cwdRef.current = workspacePath;

  // ── Push / PR state ────────────────────────────────────────────────────────
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [creatingPR, setCreatingPR] = useState(false);
  const [prResult, setPRResult] = useState<{ url: string; number: number } | null>(null);

  // ── Refresh status (generation-safe, cwd-pinned) ──────────────────────────

  const refreshStatus = useCallback(async () => {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      setGitLoading(true);
      setGitError(null);
      const status = await window.numezis.gitStatus(cwd);
      if (g !== gen()) return; // stale — workspace changed while awaiting
      setGitStatus(status);
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to get git status");
    } finally {
      if (g === gen()) setGitLoading(false);
    }
  }, [workspacePath]);

  // ── Workspace-switch effect — reset ALL state, bump generation ────────────

  useEffect(() => {
    // Bump generation so any in-flight operations from the old workspace are discarded
    genRef.current += 1;

    // Reset all stale state from the previous workspace
    setGitStatus(null);
    setGitError(null);
    setAllDiffs(new Map());
    setAllDiffsLoading(false);
    setSelectedDiffPath(null);
    setSelectedDiffContent(null);
    setCommitMessage("");
    setCommitting(false);
    setPushing(false);
    setPushResult(null);
    setCreatingPR(false);
    setPRResult(null);
    setDiffLoading(false);
    setGeneratingMessage(false);

    if (!workspacePath) return;

    void refreshStatus();
    pollRef.current = setInterval(() => void refreshStatus(), 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [workspacePath, refreshStatus]);

  // ── Commit (generation-safe, cwd-pinned) ──────────────────────────────────

  async function commit(message: string) {
    if (!message.trim()) return;
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    setCommitting(true);
    try {
      await window.numezis.gitCommit(message, cwd);
      if (g !== gen()) return;
      setCommitMessage("");
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to commit");
    } finally {
      if (g === gen()) setCommitting(false);
    }
  }

  /** Commit only staged files (no automatic git add .) */
  async function commitStaged(message: string) {
    if (!message.trim()) return;
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    setCommitting(true);
    try {
      await window.numezis.gitCommitStaged(message, cwd);
      if (g !== gen()) return;
      setCommitMessage("");
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to commit");
    } finally {
      if (g === gen()) setCommitting(false);
    }
  }

  // ── Stage / Unstage (generation-safe, cwd-pinned) ─────────────────────────

  async function stageFile(filePath: string) {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitStageFile(filePath, cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to stage file");
    }
  }

  async function stageAll() {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitStageAll(cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to stage all");
    }
  }

  async function unstageFile(filePath: string) {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitUnstageFile(filePath, cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to unstage file");
    }
  }

  async function unstageAll() {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitUnstageAll(cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to unstage all");
    }
  }

  // ── Revert (generation-safe, cwd-pinned) ──────────────────────────────────

  async function revertFile(filePath: string) {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitRevertFile(filePath, cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to revert file");
    }
  }

  async function revertAll() {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitRevertAll(cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to revert all");
    }
  }

  // ── Diff (generation-safe, cwd-pinned) ────────────────────────────────────

  async function viewDiff(filePath: string, staged = false) {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    setDiffLoading(true);
    setSelectedDiffPath(filePath);
    try {
      const content = staged
        ? await window.numezis.gitDiffStaged(filePath, cwd)
        : await window.numezis.gitDiff(filePath, cwd);
      if (g !== gen()) return;
      setSelectedDiffContent(content);
    } catch (error) {
      if (g !== gen()) return;
      setSelectedDiffContent(null);
      setGitError((error as Error)?.message || "Failed to get diff");
    } finally {
      if (g === gen()) setDiffLoading(false);
    }
  }

  function closeDiff() {
    setSelectedDiffPath(null);
    setSelectedDiffContent(null);
  }

  /** Fetch diffs for all unstaged changed files at once (generation-safe, cwd-pinned) */
  const fetchAllDiffs = useCallback(async () => {
    if (!gitStatus) { setAllDiffs(new Map()); return; }
    const files = gitStatus.unstaged ?? [];
    if (files.length === 0) { setAllDiffs(new Map()); return; }

    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    setAllDiffsLoading(true);
    const results = new Map<string, string | null>();

    // Fetch diffs in parallel (batches of 5 to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      // Check staleness before starting each batch
      if (g !== gen()) return;

      const batch = files.slice(i, i + batchSize);
      const promises = batch.map(async (f) => {
        try {
          const diff = await window.numezis.gitDiff(f.path, cwd);
          return { path: f.path, diff };
        } catch {
          return { path: f.path, diff: null };
        }
      });
      const batchResults = await Promise.all(promises);

      // Check staleness after each batch completes
      if (g !== gen()) return;

      for (const r of batchResults) {
        results.set(r.path, r.diff);
      }
    }

    if (g !== gen()) return;
    setAllDiffs(results);
    setAllDiffsLoading(false);
  }, [gitStatus]);

  // ── Push (generation-safe, cwd-pinned) ────────────────────────────────────

  async function push(remote?: string, branch?: string) {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    setPushing(true);
    setPushResult(null);
    try {
      const result = await window.numezis.gitPush(remote, branch, cwd);
      if (g !== gen()) return;
      setPushResult(result);
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to push");
    } finally {
      if (g === gen()) setPushing(false);
    }
  }

  // ── Create PR (generation-safe, cwd-pinned) ───────────────────────────────

  async function createPR(title: string, body?: string, base?: string) {
    const cwd = cwdRef.current;
    if (!cwd) return null;
    const g = gen();
    setCreatingPR(true);
    setPRResult(null);
    try {
      const result = await window.numezis.gitCreatePR(title, body, base, cwd);
      if (g !== gen()) return null;
      setPRResult(result);
      return result;
    } catch (error) {
      if (g !== gen()) return null;
      setGitError((error as Error)?.message || "Failed to create PR");
      return null;
    } finally {
      if (g === gen()) setCreatingPR(false);
    }
  }

  // ── Branch (generation-safe, cwd-pinned) ──────────────────────────────────

  async function switchBranch(branch: string) {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitCheckout(branch, cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to switch branch");
    }
  }

  async function createBranch(name: string) {
    const cwd = cwdRef.current;
    if (!cwd) return;
    const g = gen();
    try {
      await window.numezis.gitCreateBranch(name, cwd);
      if (g !== gen()) return;
      await refreshStatus();
    } catch (error) {
      if (g !== gen()) return;
      setGitError((error as Error)?.message || "Failed to create branch");
    }
  }

  // ── Generate commit message (generation-safe) ─────────────────────────────

  async function generateCommitMessage() {
    const g = gen();
    const token = await getAccessToken();
    if (!token) return;
    if (g !== gen()) return;
    setGeneratingMessage(true);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/git/commit-message`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (g !== gen()) return;
      if (res.ok) {
        const data = await res.json();
        if (data?.message) setCommitMessage(data.message);
      }
    } catch {
      // ignore
    } finally {
      if (g === gen()) setGeneratingMessage(false);
    }
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const totalChanges = gitStatus
    ? gitStatus.modified.length + gitStatus.created.length + gitStatus.deleted.length + gitStatus.renamed.length
    : 0;

  const stagedCount = gitStatus?.staged?.length ?? 0;
  const unstagedCount = gitStatus?.unstaged?.length ?? 0;

  return {
    gitStatus,
    gitLoading,
    gitError,
    commitMessage,
    setCommitMessage,
    committing,
    branches,
    generatingMessage,
    totalChanges,
    stagedCount,
    unstagedCount,
    // Actions
    refreshStatus,
    commit,
    commitStaged,
    stageFile,
    stageAll,
    unstageFile,
    unstageAll,
    revertFile,
    revertAll,
    switchBranch,
    createBranch,
    generateCommitMessage,
    // Diff viewer
    selectedDiffPath,
    selectedDiffContent,
    diffLoading,
    viewDiff,
    closeDiff,
    // Push
    pushing,
    pushResult,
    push,
    // Create PR
    creatingPR,
    prResult,
    createPR,
    // Batch diffs (for uncommitted changes panel)
    allDiffs,
    allDiffsLoading,
    fetchAllDiffs,
  };
}
