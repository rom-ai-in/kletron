"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActiveSession } from "@numezis/ui/components/Agent/ActiveSession";
import { Button, Checkbox, ThreadFeed, WorkspaceLayout } from "@numezis/ui/components/design-system";
import type { ThreadStatus } from "@numezis/ui/components/design-system";
import { Loader2, Plus, AlertTriangle, RefreshCw, PencilLine, Trash2, Check, X, Archive, Square, CheckSquare } from "lucide-react";

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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams?.get("conversationId");

  const activeConversations = useMemo(
    () => conversations.filter((conv) => conv.status !== "archived"),
    [conversations]
  );

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
    if (renamingId && !activeConversations.some((conv) => conv.id === renamingId)) {
      setRenamingId(null);
      setRenamingValue("");
    }
  }, [activeConversations, renamingId]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => activeConversations.some((conv) => conv.id === id)));
  }, [activeConversations]);

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
    const storedId = conversationIdParam || sessionStorage.getItem(STORAGE_KEY);
    if (storedId) {
      try {
        const query = workspace?.id ? `?workspaceId=${encodeURIComponent(workspace.id)}` : "";
        const res = await fetch(`/api/agent/${storedId}${query}`);
        if (res.ok) {
          const data = (await res.json()) as ConversationSummary;
          setConversationId(data.id || storedId);
          setConversationTitle(data.title || DEFAULT_TITLE);
          try {
            sessionStorage.setItem(STORAGE_KEY, data.id || storedId);
          } catch {
            // ignore sessionStorage errors
          }
          setLoading(false);
          void fetchConversations();
          return;
        }
      } catch (err) {
        console.warn("Failed to restore conversation, creating new", err);
      }
    }
    await createConversation();
  }, [createConversation, fetchConversations, workspace?.id, conversationIdParam]);

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
    [workspace?.id, conversationId, resolveConversation, fetchConversations]
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const selectAll = useCallback(() => {
    setSelectedIds(activeConversations.map((conv) => conv.id));
  }, [activeConversations]);

  const handleBulkArchive = useCallback(async () => {
    if (!selectedIds.length) return;
    await deleteConversations(selectedIds, false);
    clearSelection();
  }, [selectedIds, deleteConversations, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.length) return;
    await deleteConversations(selectedIds, true);
    clearSelection();
  }, [selectedIds, deleteConversations, clearSelection]);

  useEffect(() => {
    void loadWorkspace();
    void resolveConversation();
    void fetchConversations();
  }, [loadWorkspace, resolveConversation, fetchConversations]);

  const handleNewSession = async () => {
    cancelRename();
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

  const threadItems = activeConversations.map((conv) => {
    const isRenaming = renamingId === conv.id;
    const isSelected = selectedIds.includes(conv.id);
    const subtitle =
      conv.lastRole === "user"
        ? "Awaiting response"
        : conv.lastRole === "assistant"
          ? "Agent replied"
          : "Idle";
    const status: ThreadStatus =
      conv.lastRole === "user"
        ? "waiting"
        : conv.lastRole === "assistant"
          ? "active"
          : "idle";

    return {
      id: conv.id,
      leading: (
        <div
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          <Checkbox
            checked={isSelected}
            onChange={() => toggleSelection(conv.id)}
            size="sm"
            aria-label={isSelected ? "Deselect session" : "Select session"}
          />
        </div>
      ),
      title: isRenaming ? (
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
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void submitRename();
            }}
            disabled={renameLoading}
            size="icon"
            variant="secondary"
            className="h-6 w-6"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              cancelRename();
            }}
            size="icon"
            variant="ghost"
            className="h-6 w-6"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <span
          className="text-[12px] font-semibold text-text-primary truncate"
          onClick={(event) => {
            event.stopPropagation();
            startRename(conv);
          }}
        >
          {conv.title || DEFAULT_TITLE}
        </span>
      ),
      subtitle,
      meta: formatConversationTime(conv.updatedAt),
      status,
      actions: !isRenaming ? (
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              startRename(conv);
            }}
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Rename session"
          >
            <PencilLine className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void deleteConversations([conv.id], false);
            }}
            disabled={bulkActionLoading}
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Archive session"
          >
            <Archive className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void deleteConversations([conv.id], true);
            }}
            disabled={bulkActionLoading}
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Delete session"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : null,
    };
  });

  const threadEmptyState = conversationsLoading ? (
    <div className="flex items-center justify-center py-6 text-text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  ) : conversationsError ? (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-3 text-xs text-text-muted">
      {conversationsError}
    </div>
  ) : activeConversations.length === 0 ? (
    <div className="rounded-lg border border-dashed border-border-subtle bg-bg-elevated/40 p-4 text-center text-[11px] text-text-muted">
      No sessions yet.
      <div className="mt-2 flex justify-center">
        <Button size="xs" onClick={handleNewSession}>
          Start a session
        </Button>
      </div>
    </div>
  ) : null;

  const threadFooter = <span>{activeConversations.length} active</span>;

  return (
    <WorkspaceLayout
      content={(
        <div className="flex h-full min-h-0 flex-col bg-bg-surface">
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Explore</h2>
            {workspace?.name ? (
              <span className="text-[10px] text-text-muted">{workspace.name}</span>
            ) : null}
          </div>
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
                  <div className="max-w-md rounded-lg border border-border-subtle bg-bg-surface p-6 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-status-error-border bg-status-error-bg">
                      <AlertTriangle className="h-5 w-5 text-status-error-text" />
                    </div>
                    <h2 className="text-base font-semibold text-text-primary">Session unavailable</h2>
                    <p className="mt-2 text-sm text-text-muted">{error}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        onClick={() => void resolveConversation()}
                        size="sm"
                        variant="secondary"
                      >
                        Try again
                      </Button>
                      {error.toLowerCase().includes("workspace") && (
                        <Link
                          href="/app/config/workspace"
                          className="inline-flex h-7 items-center justify-center rounded-md border border-border-subtle bg-bg-surface px-3 text-[11px] font-semibold text-text-muted transition hover:bg-state-hover hover:text-text-primary"
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
      )}
      aside={(
        <div className="flex h-full min-h-0 flex-col p-3">
          <div className="flex-1 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface">
            <ThreadFeed
              title=""
              items={conversationsLoading || conversationsError ? [] : threadItems}
              activeId={conversationId ?? undefined}
              showCount={false}
              showTitle={false}
              onSelect={(id) => {
                const conv = activeConversations.find((item) => item.id === id);
                if (conv) handleSelectConversation(conv);
              }}
              headerAction={(
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    onClick={selectedIds.length === activeConversations.length ? clearSelection : selectAll}
                    disabled={!activeConversations.length}
                    size="icon"
                    variant="secondary"
                    title={selectedIds.length === activeConversations.length ? "Clear selection" : "Select all"}
                  >
                    {selectedIds.length === activeConversations.length ? (
                      <CheckSquare className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleBulkArchive}
                    disabled={!selectedIds.length || bulkActionLoading}
                    size="icon"
                    variant="secondary"
                    title="Archive"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={!selectedIds.length || bulkActionLoading}
                    size="icon"
                    variant="secondary"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <div className="mx-1 h-4 w-px bg-border-subtle" />
                  <Button
                    type="button"
                    onClick={handleNewSession}
                    disabled={creating}
                    size="icon"
                    variant="secondary"
                    title="New session"
                  >
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    onClick={fetchConversations}
                    size="icon"
                    variant="secondary"
                    title="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              footer={threadFooter}
              emptyState={threadEmptyState ?? undefined}
              className="h-full"
            />
          </div>
        </div>
      )}
      asideWidth="w-[360px]"
    />
  );
}
