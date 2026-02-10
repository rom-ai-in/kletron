import { useCallback, useEffect, useRef, useState } from "react";
import type { GitStatusInfo } from "../types";

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

  const refreshStatus = useCallback(async () => {
    if (!workspacePath) return;
    try {
      setGitLoading(true);
      setGitError(null);
      const status = await window.numezis.gitStatus();
      setGitStatus(status);
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to get git status");
    } finally {
      setGitLoading(false);
    }
  }, [workspacePath]);

  // Poll git status every 10 seconds
  useEffect(() => {
    if (!workspacePath) {
      setGitStatus(null);
      return;
    }
    void refreshStatus();
    pollRef.current = setInterval(() => void refreshStatus(), 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [workspacePath, refreshStatus]);

  // ── Commit ──────────────────────────────────────────────────────────────────

  async function commit(message: string) {
    if (!message.trim()) return;
    setCommitting(true);
    try {
      await window.numezis.gitCommit(message);
      setCommitMessage("");
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to commit");
    } finally {
      setCommitting(false);
    }
  }

  /** Commit only staged files (no automatic git add .) */
  async function commitStaged(message: string) {
    if (!message.trim()) return;
    setCommitting(true);
    try {
      await window.numezis.gitCommitStaged(message);
      setCommitMessage("");
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to commit");
    } finally {
      setCommitting(false);
    }
  }

  // ── Stage / Unstage ─────────────────────────────────────────────────────────

  async function stageFile(filePath: string) {
    try {
      await window.numezis.gitStageFile(filePath);
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to stage file");
    }
  }

  async function stageAll() {
    try {
      await window.numezis.gitStageAll();
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to stage all");
    }
  }

  async function unstageFile(filePath: string) {
    try {
      await window.numezis.gitUnstageFile(filePath);
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to unstage file");
    }
  }

  async function unstageAll() {
    try {
      await window.numezis.gitUnstageAll();
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to unstage all");
    }
  }

  // ── Revert ──────────────────────────────────────────────────────────────────

  async function revertFile(filePath: string) {
    try {
      await window.numezis.gitRevertFile(filePath);
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to revert file");
    }
  }

  async function revertAll() {
    try {
      await window.numezis.gitRevertAll();
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to revert all");
    }
  }

  // ── Diff ────────────────────────────────────────────────────────────────────

  async function viewDiff(filePath: string, staged = false) {
    setDiffLoading(true);
    setSelectedDiffPath(filePath);
    try {
      const content = staged
        ? await window.numezis.gitDiffStaged(filePath)
        : await window.numezis.gitDiff(filePath);
      setSelectedDiffContent(content);
    } catch (error) {
      setSelectedDiffContent(null);
      setGitError((error as Error)?.message || "Failed to get diff");
    } finally {
      setDiffLoading(false);
    }
  }

  function closeDiff() {
    setSelectedDiffPath(null);
    setSelectedDiffContent(null);
  }

  /** Fetch diffs for all unstaged changed files at once */
  const fetchAllDiffs = useCallback(async () => {
    if (!gitStatus) { setAllDiffs(new Map()); return; }
    const files = gitStatus.unstaged ?? [];
    if (files.length === 0) { setAllDiffs(new Map()); return; }

    setAllDiffsLoading(true);
    const results = new Map<string, string | null>();

    // Fetch diffs in parallel (batches of 5 to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const promises = batch.map(async (f) => {
        try {
          const diff = await window.numezis.gitDiff(f.path);
          return { path: f.path, diff };
        } catch {
          return { path: f.path, diff: null };
        }
      });
      const batchResults = await Promise.all(promises);
      for (const r of batchResults) {
        results.set(r.path, r.diff);
      }
    }

    setAllDiffs(results);
    setAllDiffsLoading(false);
  }, [gitStatus]);

  // ── Push ──────────────────────────────────────────────────────────────────

  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  async function push(remote?: string, branch?: string) {
    setPushing(true);
    setPushResult(null);
    try {
      const result = await window.numezis.gitPush(remote, branch);
      setPushResult(result);
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to push");
    } finally {
      setPushing(false);
    }
  }

  // ── Create PR ────────────────────────────────────────────────────────────────

  const [creatingPR, setCreatingPR] = useState(false);
  const [prResult, setPRResult] = useState<{ url: string; number: number } | null>(null);

  async function createPR(title: string, body?: string, base?: string) {
    setCreatingPR(true);
    setPRResult(null);
    try {
      const result = await window.numezis.gitCreatePR(title, body, base);
      setPRResult(result);
      return result;
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to create PR");
      return null;
    } finally {
      setCreatingPR(false);
    }
  }

  // ── Branch ──────────────────────────────────────────────────────────────────

  async function switchBranch(branch: string) {
    try {
      await window.numezis.gitCheckout(branch);
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to switch branch");
    }
  }

  async function createBranch(name: string) {
    try {
      await window.numezis.gitCreateBranch(name);
      await refreshStatus();
    } catch (error) {
      setGitError((error as Error)?.message || "Failed to create branch");
    }
  }

  // ── Generate commit message ─────────────────────────────────────────────────

  async function generateCommitMessage() {
    const token = await getAccessToken();
    if (!token) return;
    setGeneratingMessage(true);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/git/commit-message`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.message) setCommitMessage(data.message);
      }
    } catch {
      // ignore
    } finally {
      setGeneratingMessage(false);
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
