import { useState, useEffect, useRef, useCallback } from "react";
import type { ConversationHistoryItem, ThreadLiveStatus } from "../types";

export function useThreads(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>,
  activeWorkspaceId: string | null
) {
  const [threads, setThreads] = useState<ConversationHistoryItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string>("");
  const [editingThreadSaving, setEditingThreadSaving] = useState(false);
  const [threadActionId, setThreadActionId] = useState<string | null>(null);

  async function loadThreads(preferredId?: string) {
    const token = await getAccessToken();
    if (!token) return;
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;

      const res = await fetch(`${backendUrlTrimmed}/api/sessions?limit=50`, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load threads (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? (data as ConversationHistoryItem[]) : [];
      const active = list.filter((item) => item.status !== "archived");
      setThreads(active);
      if (preferredId && active.some((item) => item.id === preferredId)) {
        setConversationId(preferredId);
      } else if (!conversationId || !active.some((item) => item.id === conversationId)) {
        setConversationId(active[0]?.id ?? null);
      }
    } catch (error) {
      setThreadsError((error as Error)?.message || "Unable to load threads.");
    } finally {
      setThreadsLoading(false);
    }
  }

  /**
   * In the unified session system, sessions are created on first message send
   * via POST /api/sessions. This function is kept for API compatibility but
   * simply returns null — the conversation hook handles session creation.
   */
  async function createConversation(_selectedGraph?: string | null, _graphName?: string) {
    return null;
  }

  function startEditThread(thread: ConversationHistoryItem) {
    setEditingThreadId(thread.id);
    setEditingThreadTitle(thread.title || "");
  }

  function cancelEditThread() {
    setEditingThreadId(null);
    setEditingThreadTitle("");
  }

  async function saveEditedThreadTitle() {
    if (!editingThreadId) return;
    const nextTitle = editingThreadTitle.trim();
    if (!nextTitle) return;
    setEditingThreadSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired.");
      const res = await fetch(`${backendUrlTrimmed}/api/sessions/${editingThreadId}/title`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(activeWorkspaceId ? { "x-workspace-id": activeWorkspaceId } : {}),
        },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to update title (${res.status})`);
      }
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === editingThreadId ? { ...thread, title: nextTitle } : thread
        )
      );
      cancelEditThread();
    } catch {
      // ignore
    } finally {
      setEditingThreadSaving(false);
    }
  }

  async function archiveThread(threadId: string) {
    if (!threadId) return;
    const confirmed = window.confirm("Archive this thread?");
    if (!confirmed) return;
    setThreadActionId(threadId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired.");
      const res = await fetch(`${backendUrlTrimmed}/api/sessions/${encodeURIComponent(threadId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeWorkspaceId ? { "x-workspace-id": activeWorkspaceId } : {}),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to archive thread (${res.status})`);
      }
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      if (conversationId === threadId) {
        setConversationId(null);
      }
    } catch {
      // ignore
    } finally {
      setThreadActionId(null);
    }
  }

  async function deleteThread(threadId: string) {
    if (!threadId) return;
    const confirmed = window.confirm("Delete this thread permanently? This cannot be undone.");
    if (!confirmed) return;
    setThreadActionId(threadId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired.");
      const res = await fetch(
        `${backendUrlTrimmed}/api/sessions/${encodeURIComponent(threadId)}?action=delete`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(activeWorkspaceId ? { "x-workspace-id": activeWorkspaceId } : {}),
          },
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to delete thread (${res.status})`);
      }
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      if (conversationId === threadId) {
        setConversationId(null);
      }
    } catch {
      // ignore
    } finally {
      setThreadActionId(null);
    }
  }

  function resetThreads() {
    setConversationId(null);
    setThreads([]);
  }

  // ── Live status polling ─────────────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollThreadStatus = useCallback(async () => {
    if (!backendReady || threads.length === 0) return;
    const token = await getAccessToken();
    if (!token) return;
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;

      const res = await fetch(`${backendUrlTrimmed}/api/sessions?limit=50`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? (data as ConversationHistoryItem[]) : [];
      const active = list.filter((item) => item.status !== "archived");
      // Only update if there are actual changes
      setThreads((prev) => {
        const changed = active.some((newThread) => {
          const old = prev.find((t) => t.id === newThread.id);
          return !old || old.lastRole !== newThread.lastRole || old.status !== newThread.status || old.title !== newThread.title;
        });
        return changed ? active : prev;
      });
    } catch {
      // silent polling failure
    }
  }, [backendUrlTrimmed, backendReady, getAccessToken, threads.length]);

  useEffect(() => {
    // Poll every 5 seconds when we have active threads
    if (threads.length === 0 || !backendReady) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(pollThreadStatus, 5000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [threads.length, backendReady, pollThreadStatus]);

  /** Derive live status from thread data */
  function getThreadLiveStatus(thread: ConversationHistoryItem): ThreadLiveStatus {
    if (thread.status === "archived") return "idle";
    if (thread.lastRole === "user" || thread.lastRole === "tool") return "running";
    if (thread.lastRole === "assistant") return "idle";
    return "idle";
  }

  return {
    threads,
    threadsLoading,
    threadsError,
    conversationId,
    setConversationId,
    editingThreadId,
    editingThreadTitle,
    setEditingThreadTitle,
    editingThreadSaving,
    threadActionId,
    loadThreads,
    createConversation,
    startEditThread,
    cancelEditThread,
    saveEditedThreadTitle,
    archiveThread,
    deleteThread,
    resetThreads,
    getThreadLiveStatus,
  };
}
