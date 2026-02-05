"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActiveSession } from "@numezis/ui/components/Agent/ActiveSession";
import { Checkbox } from "@numezis/ui/components/design-system";
import { Loader2, Plus, AlertTriangle, RefreshCw, PencilLine, Trash2, Check, X, Archive } from "lucide-react";

type WorkspaceSummary = {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
};

type ConversationSummary = {
  id: string;
  title: string;
};

type ConversationHistoryItem = {
  id: string;
  title: string;
  updatedAt: string;
  status?: "active" | "archived";
  lastRole?: "user" | "assistant" | "system" | "tool";
};

const STORAGE_KEY = "workbench-active-conversation";
const DEFAULT_TITLE = "Explore Session";

async function readError(res: Response) {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

export default function ExplorePage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState(DEFAULT_TITLE);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [conversations, setConversations] = useState<ConversationHistoryItem[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);

  const workspaceLabel = useMemo(() => {
    if (!workspace) return "No workspace selected";
    return workspace.name || workspace.rootPath;
  }, [workspace]);

  const activeConversations = useMemo(
    () => conversations.filter((conv) => conv.status !== "archived"),
    [conversations]
  );
  const selectedCount = selectedIds.length;
  const isAllSelected = activeConversations.length > 0 && selectedCount === activeConversations.length;
  const isIndeterminate = selectedCount > 0 && !isAllSelected;

  const fetchConversations = useCallback(async () => {
    setConversationsLoading(true);
    setConversationsError(null);
    try {
      const query = workspace?.id ? `?workspaceId=${encodeURIComponent(workspace.id)}` : "";
      const res = await fetch(`/api/agent${query}`);
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      const data = (await res.json()) as ConversationHistoryItem[];
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      setConversationsError(err instanceof Error ? err.message : "Unable to load history.");
    } finally {
      setConversationsLoading(false);
    }
  }, [workspace?.id]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(activeConversations.map((conv) => conv.id));
  }, [activeConversations]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const startRename = useCallback((conv: ConversationHistoryItem) => {
    setRenamingId(conv.id);
    setRenamingValue(conv.title || DEFAULT_TITLE);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenamingValue("");
  }, []);

  const submitRename = useCallback(async () => {
    if (!renamingId) return;
    const title = renamingValue.trim();
    if (!title) return;
    setRenameLoading(true);
    setConversationsError(null);
    try {
      const res = await fetch("/api/agent/update-title", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: renamingId,
          title,
          ...(workspace?.id ? { workspaceId: workspace.id } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      setConversations((prev) =>
        prev.map((conv) => (conv.id === renamingId ? { ...conv, title } : conv))
      );
      if (conversationId === renamingId) {
        setConversationTitle(title);
      }
      cancelRename();
    } catch (err) {
      setConversationsError(err instanceof Error ? err.message : "Unable to rename session.");
    } finally {
      setRenameLoading(false);
    }
  }, [renamingId, renamingValue, workspace?.id, conversationId, cancelRename]);


  const formatConversationTime = useCallback((iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => activeConversations.some((conv) => conv.id === id)));
    if (renamingId && !activeConversations.some((conv) => conv.id === renamingId)) {
      setRenamingId(null);
      setRenamingValue("");
    }
  }, [activeConversations, renamingId]);

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces/active");
      if (!res.ok) return;
      const data = await res.json();
      setWorkspace(data.workspace ?? null);
    } catch (err) {
      console.error("Failed to load workspace", err);
    }
  }, []);

  const createConversation = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: DEFAULT_TITLE, ...(workspace?.id ? { workspaceId: workspace.id } : {}) }),
      });
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      const data = (await res.json()) as ConversationSummary;
      if (data?.id) {
        sessionStorage.setItem(STORAGE_KEY, data.id);
      }
      setConversationId(data.id);
      setConversationTitle(data.title || DEFAULT_TITLE);
      void fetchConversations();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start a session.");
      return null;
    } finally {
      setCreating(false);
      setLoading(false);
    }
  }, [fetchConversations, workspace?.id]);

  const resolveConversation = useCallback(async () => {
    setLoading(true);
    setError(null);
    const storedId = sessionStorage.getItem(STORAGE_KEY);
    if (storedId) {
      try {
        const query = workspace?.id ? `?workspaceId=${encodeURIComponent(workspace.id)}` : "";
        const res = await fetch(`/api/agent/${storedId}${query}`);
        if (res.ok) {
          const data = (await res.json()) as ConversationSummary;
          setConversationId(data.id || storedId);
          setConversationTitle(data.title || DEFAULT_TITLE);
          setLoading(false);
          void fetchConversations();
          return;
        }
      } catch (err) {
        console.warn("Failed to restore conversation, creating new", err);
      }
    }
    await createConversation();
  }, [createConversation, fetchConversations, workspace?.id]);

  const deleteConversations = useCallback(
    async (ids: string[], permanent = true) => {
      if (!ids.length) return;
      const confirmText =
        ids.length === 1
          ? "Delete this session? This cannot be undone."
          : `Delete ${ids.length} sessions? This cannot be undone.`;
      if (!window.confirm(confirmText)) return;
      setBulkActionLoading(true);
      setConversationsError(null);
      try {
        await Promise.all(
          ids.map(async (id) => {
            const params = new URLSearchParams();
            params.set("id", id);
            if (workspace?.id) params.set("workspaceId", workspace.id);
            if (permanent) params.set("permanent", "true");
            const res = await fetch(`/api/agent?${params.toString()}`, { method: "DELETE" });
            if (!res.ok) {
              throw new Error(await readError(res));
            }
          })
        );
        const activeDeleted = conversationId ? ids.includes(conversationId) : false;
        setConversations((prev) => prev.filter((conv) => !ids.includes(conv.id)));
        clearSelection();
        if (activeDeleted) {
          sessionStorage.removeItem(STORAGE_KEY);
          setConversationId(null);
          setConversationTitle(DEFAULT_TITLE);
          await resolveConversation();
        } else {
          await fetchConversations();
        }
      } catch (err) {
        setConversationsError(err instanceof Error ? err.message : "Unable to delete sessions.");
      } finally {
        setBulkActionLoading(false);
      }
    },
    [workspace?.id, conversationId, clearSelection, resolveConversation, fetchConversations]
  );

  useEffect(() => {
    void loadWorkspace();
    void resolveConversation();
    void fetchConversations();
  }, [loadWorkspace, resolveConversation, fetchConversations]);

  const handleNewSession = async () => {
    cancelRename();
    clearSelection();
    await createConversation();
  };

  const handleSelectConversation = useCallback(
    (conv: ConversationHistoryItem) => {
      setConversationId(conv.id);
      setConversationTitle(conv.title || DEFAULT_TITLE);
      sessionStorage.setItem(STORAGE_KEY, conv.id);
      setError(null);
      cancelRename();
    },
    [cancelRename]
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setConversationTitle(newTitle);
      if (!conversationId) return;
      setConversations((prev) =>
        prev.map((conv) => (conv.id === conversationId ? { ...conv, title: newTitle } : conv))
      );
    },
    [conversationId]
  );

  const handleApproveEdit = useCallback(async (editId: string) => {
    try {
      await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editId }),
      });
    } catch (err) {
      console.error("Failed to approve edit", err);
    }
  }, []);

  const handleApproveAll = useCallback(async () => {
    if (!conversationId) return;
    try {
      await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, action: "all" }),
      });
    } catch (err) {
      console.error("Failed to approve all edits", err);
    }
  }, [conversationId]);

  const handleRejectEdit = useCallback(async (editId: string) => {
    try {
      await fetch("/api/agent/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editId }),
      });
    } catch (err) {
      console.error("Failed to reject edit", err);
    }
  }, []);

  const handleRejectAll = useCallback(async () => {
    if (!conversationId) return;
    try {
      await fetch("/api/agent/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, action: "all" }),
      });
    } catch (err) {
      console.error("Failed to reject all edits", err);
    }
  }, [conversationId]);

  return (
    <div className="flex h-full flex-col bg-bg-app text-text-primary">
      <header className="flex items-center justify-between border-b border-border-subtle bg-bg-surface/80 px-6 py-4">
        <div className="space-y-1">
          <p className="text-[11px] text-text-muted">Workspace</p>
          <h1 className="text-lg font-semibold text-text-primary">
            {workspace?.name || (workspace?.rootPath ? workspace.rootPath.split("/").filter(Boolean).pop() : "No workspace selected")}
          </h1>
          <p className="text-[11px] text-text-muted">{workspace?.rootPath || workspaceLabel}</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-60 shrink-0 border-r border-border-subtle bg-bg-surface">
          <div className="border-b border-border-subtle">
            <div className="flex items-center justify-end px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNewSession}
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-[10px] font-semibold text-text-muted transition hover:bg-state-hover hover:text-text-primary disabled:opacity-60"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  New
                </button>
                <button
                  type="button"
                  onClick={fetchConversations}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-[10px] font-semibold text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border-subtle bg-bg-elevated/40 px-4 py-2 text-[10px] text-text-muted">
              <div className="flex items-center gap-2">
                <Checkbox
                  size="sm"
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={() => (isAllSelected ? clearSelection() : selectAll())}
                  aria-label="Select all sessions"
                />
                {selectedCount > 0 && <span>{selectedCount}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => deleteConversations(selectedIds, false)}
                  disabled={selectedCount === 0 || bulkActionLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted transition hover:bg-state-hover hover:text-text-primary disabled:opacity-50"
                >
                  <Archive className="h-3 w-3" />
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => deleteConversations(selectedIds, true)}
                  disabled={selectedCount === 0 || bulkActionLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted transition hover:bg-state-hover hover:text-text-primary disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted transition hover:bg-state-hover hover:text-text-primary disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 scrollbar-elegant">
            {conversationsLoading && (
              <div className="flex items-center justify-center py-6 text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!conversationsLoading && conversationsError && (
              <div className="rounded-lg border border-border-subtle bg-bg-elevated p-3 text-xs text-text-muted">
                {conversationsError}
              </div>
            )}
            {!conversationsLoading && !conversationsError && activeConversations.length === 0 && (
              <div className="rounded-lg border border-dashed border-border-subtle bg-bg-elevated/40 p-4 text-center text-[11px] text-text-muted">
                No sessions yet.
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="mt-2 inline-flex items-center justify-center rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] font-semibold text-text-secondary transition hover:bg-state-hover"
                >
                  Start a session
                </button>
              </div>
            )}
            {!conversationsLoading && !conversationsError && activeConversations.length > 0 && (
              <div className="space-y-2">
                {activeConversations.map((conv) => {
                  const isActive = conv.id === conversationId;
                  const isRenaming = renamingId === conv.id;
                  const isSelected = selectedIds.includes(conv.id);
                  return (
                    <div
                      key={conv.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectConversation(conv)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectConversation(conv);
                        }
                      }}
                      className={`group w-full rounded-lg border px-3 py-2 text-left transition ${isActive
                        ? "border-border-strong bg-state-selected"
                        : "border-border-subtle bg-bg-surface hover:bg-state-hover"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <div
                            className="mt-0.5"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              size="sm"
                              checked={isSelected}
                              onChange={() => toggleSelected(conv.id)}
                              aria-label={`Select ${conv.title || DEFAULT_TITLE}`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            {isRenaming ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={renamingValue}
                                  onChange={(event) => setRenamingValue(event.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void submitRename();
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelRename();
                                    }
                                  }}
                                  className="h-6 w-full rounded-md border border-border-subtle bg-bg-elevated px-2 text-[11px] text-text-primary focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void submitRename();
                                  }}
                                  disabled={renameLoading}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted transition hover:bg-state-hover hover:text-text-primary disabled:opacity-50"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    cancelRename();
                                  }}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[12px] font-semibold text-text-primary truncate">
                                {conv.title || DEFAULT_TITLE}
                              </span>
                            )}
                            <span className="mt-1 block text-[10px] text-text-muted">
                              {conv.lastRole === "user"
                                ? "Awaiting response"
                                : conv.lastRole === "assistant"
                                  ? "Agent replied"
                                  : "Idle"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-text-muted">
                            {formatConversationTime(conv.updatedAt)}
                          </span>
                          {!isRenaming && (
                            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startRename(conv);
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                title="Rename session"
                              >
                                <PencilLine className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteConversations([conv.id], false);
                                }}
                                disabled={bulkActionLoading}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted transition hover:bg-state-hover hover:text-text-primary disabled:opacity-50"
                                title="Archive session"
                              >
                                <Archive className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteConversations([conv.id], true);
                                }}
                                disabled={bulkActionLoading}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted transition hover:bg-state-hover hover:text-text-primary disabled:opacity-50"
                                title="Delete session"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2 text-[10px] text-text-muted">
            <span>{activeConversations.length} active</span>
            {selectedCount > 0 && <span>{selectedCount}</span>}
          </div>
        </aside>

        <div className="flex-1 min-h-0">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-text-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm">Preparing your agent workspace…</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-border-subtle bg-bg-surface p-6 text-center shadow-lg">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/10">
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                </div>
                <h2 className="text-base font-semibold text-text-primary">Session unavailable</h2>
                <p className="mt-2 text-sm text-text-muted">{error}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void resolveConversation()}
                    className="rounded-md border border-border-subtle bg-bg-elevated px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-state-hover"
                  >
                    Try again
                  </button>
                  {error.toLowerCase().includes("workspace") && (
                    <Link
                      href="/app/config/workspace"
                      className="rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-xs font-semibold text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                    >
                      Workspace Settings
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && !error && conversationId && (
          <ActiveSession
            conversationId={conversationId}
            title={conversationTitle}
            onApproveEdit={handleApproveEdit}
            onApproveAll={handleApproveAll}
            onRejectEdit={handleRejectEdit}
            onRejectAll={handleRejectAll}
            onTitleChange={handleTitleChange}
            showGraphSelector={false}
            showContextButtons={false}
            workspaceId={workspace?.id}
          />
          )}
        </div>
      </div>
    </div>
  );
}
