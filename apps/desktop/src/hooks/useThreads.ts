import { useState } from "react";
import type { ConversationHistoryItem } from "../types";

export function useThreads(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>
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
      const res = await fetch(`${backendUrlTrimmed}/api/agent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  async function createConversation(selectedGraph?: string | null, graphName?: string) {
    if (!backendReady) return null;
    const token = await getAccessToken();
    if (!token) return null;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "New thread" }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to create thread (${res.status})`);
      }
      const data = await res.json();
      if (data?.id) {
        setConversationId(data.id);
        await loadThreads(data.id);
        return data.id as string;
      }
    } catch {
      // ignore
    }
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
      const res = await fetch(`${backendUrlTrimmed}/api/agent/update-title`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: editingThreadId, title: nextTitle }),
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
      const res = await fetch(`${backendUrlTrimmed}/api/agent?id=${encodeURIComponent(threadId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
        `${backendUrlTrimmed}/api/agent?id=${encodeURIComponent(threadId)}&permanent=true`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
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
  };
}
