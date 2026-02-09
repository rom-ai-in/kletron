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

  const totalChanges = gitStatus
    ? gitStatus.modified.length + gitStatus.created.length + gitStatus.deleted.length + gitStatus.renamed.length
    : 0;

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
    refreshStatus,
    commit,
    switchBranch,
    createBranch,
    generateCommitMessage,
  };
}
