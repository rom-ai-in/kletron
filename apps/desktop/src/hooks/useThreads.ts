import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import type { WorkModeId } from "@kletron/shared/workMode";
import { inferSessionListStatus } from "@kletron/shared/chatTypes";
import type { ConversationHistoryItem, ThreadLiveStatus } from "../types";
import {
  mergePreferredIntoSessionList,
  pickConversationIdAfterLoad,
} from "../utils/threadListMerge";

/** GET /api/sessions returns startedAt/endedAt; sidebar recency uses updatedAt. */
type SessionListRow = ConversationHistoryItem & {
  archived?: boolean;
  startedAt?: string;
  endedAt?: string | null;
};

function normalizeSessionListRow(raw: SessionListRow): ConversationHistoryItem & { archived?: boolean } {
  const updatedAt =
    raw.updatedAt ??
    (typeof raw.endedAt === "string" && raw.endedAt ? raw.endedAt : undefined) ??
    raw.startedAt;
  const status = inferSessionListStatus(raw) ?? raw.status;
  return { ...raw, updatedAt, status };
}

export function useThreads(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>,
  activeWorkspaceId: string | null,
  listWorkMode: WorkModeId,
) {
  const [threads, setThreads] = useState<ConversationHistoryItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string>("");
  const [editingThreadSaving, setEditingThreadSaving] = useState(false);
  const [threadActionId, setThreadActionId] = useState<string | null>(null);
  const [archivedThreads, setArchivedThreads] = useState<ConversationHistoryItem[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const skipAutoSelectAfterModeChangeRef = useRef(false);
  const prevListWorkModeRef = useRef(listWorkMode);
  useEffect(() => {
    if (prevListWorkModeRef.current !== listWorkMode) {
      prevListWorkModeRef.current = listWorkMode;
      skipAutoSelectAfterModeChangeRef.current = true;
    }
  }, [listWorkMode]);

  const didInitialThreadsFetchRef = useRef(false);

  function isThreadArchived(item: ConversationHistoryItem & { archived?: boolean }) {
    return Boolean(item.archived) || item.status === "archived";
  }

  const sessionsListUrl = useCallback(
    (includeArchived: boolean) => {
      const q = new URLSearchParams();
      q.set("limit", "50");
      q.set("workMode", listWorkMode);
      if (activeWorkspaceId) q.set("workspaceId", activeWorkspaceId);
      if (includeArchived) q.set("includeArchived", "true");
      return `${backendUrlTrimmed}/api/sessions?${q.toString()}`;
    },
    [backendUrlTrimmed, activeWorkspaceId, listWorkMode],
  );

  const loadThreads = useCallback(
    async (preferredId?: string, options?: { provisionalTitle?: string }) => {
      setThreadsLoading(true);
      setThreadsError(null);
      try {
        const token = await getAccessToken();
        if (!token) return;

        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;

        const res = await fetch(sessionsListUrl(false), { headers });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to load threads (${res.status})`);
        }
        const data = await res.json();
        const list = Array.isArray(data)
          ? (data as SessionListRow[]).map(normalizeSessionListRow)
          : [];
        const active = list.filter((item) => !isThreadArchived(item));

        const skipAuto = skipAutoSelectAfterModeChangeRef.current;
        skipAutoSelectAfterModeChangeRef.current = false;

        let merged: ConversationHistoryItem[] = [];
        setThreads((prev) => {
          merged = mergePreferredIntoSessionList(active, preferredId, {
            provisionalTitle: options?.provisionalTitle,
            provisionalWorkMode: listWorkMode,
            prevThreads: prev,
          });
          return merged;
        });
        const selectionHint = preferredId ?? conversationIdRef.current ?? undefined;
        setConversationId((curr) =>
          pickConversationIdAfterLoad(merged, selectionHint, curr, { skipAutoSelectFirst: skipAuto }),
        );
      } catch (error) {
        setThreadsError((error as Error)?.message || "Unable to load threads.");
      } finally {
        setThreadsLoading(false);
      }
    },
    [getAccessToken, activeWorkspaceId, sessionsListUrl, listWorkMode],
  );

  /** Before paint: drop stale rows and show list skeleton when Code ↔ Work or workspace scope changes. */
  useLayoutEffect(() => {
    if (!backendReady) return;
    if (!didInitialThreadsFetchRef.current) {
      didInitialThreadsFetchRef.current = true;
      return;
    }
    setThreads([]);
    void loadThreads(conversationIdRef.current ?? undefined);
  }, [listWorkMode, activeWorkspaceId, backendReady, loadThreads]);

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
          thread.id === editingThreadId ? { ...thread, title: nextTitle } : thread,
        ),
      );
      cancelEditThread();
    } catch (err) {
      console.warn("[useThreads] Failed to save thread title", err);
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
      void loadArchivedThreads();
    } catch (err) {
      console.warn("[useThreads] Failed to archive thread", err);
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
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to delete thread (${res.status})`);
      }
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      setArchivedThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      if (conversationId === threadId) {
        setConversationId(null);
      }
    } catch (err) {
      console.warn("[useThreads] Failed to delete thread", err);
    } finally {
      setThreadActionId(null);
    }
  }

  const loadArchivedThreads = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setArchivedLoading(true);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
      const res = await fetch(sessionsListUrl(true), { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? (data as SessionListRow[]).map(normalizeSessionListRow)
        : [];
      setArchivedThreads(list.filter((item) => isThreadArchived(item)));
    } catch {
      setArchivedThreads([]);
    } finally {
      setArchivedLoading(false);
    }
  }, [getAccessToken, activeWorkspaceId, sessionsListUrl]);

  function resetThreads() {
    setConversationId(null);
    setThreads([]);
    setArchivedThreads([]);
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

      const res = await fetch(sessionsListUrl(false), { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? (data as SessionListRow[]).map(normalizeSessionListRow)
        : [];
      const active = list.filter((item) => !isThreadArchived(item));
      const preferredId = conversationIdRef.current ?? undefined;
      setThreads((prev) => {
        const merged = mergePreferredIntoSessionList(active, preferredId, {
          prevThreads: prev,
          provisionalWorkMode: listWorkMode,
        });
        const same =
          merged.length === prev.length &&
          merged.every((t) => {
            const o = prev.find((p) => p.id === t.id);
            return (
              o &&
              o.title === t.title &&
              o.lastRole === t.lastRole &&
              (o.status ?? "") === (t.status ?? "")
            );
          });
        return same ? prev : merged;
      });
    } catch (err) {
      console.warn("[useThreads] Thread status poll failed", err);
    }
  }, [
    backendReady,
    getAccessToken,
    threads.length,
    sessionsListUrl,
    activeWorkspaceId,
    listWorkMode,
  ]);

  useEffect(() => {
    // Poll every 5 seconds when we have active threads
    if (threads.length === 0 || !backendReady) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => {
      void pollThreadStatus();
    }, 5000);
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
    archivedThreads,
    archivedLoading,
    loadArchivedThreads,
  };
}
