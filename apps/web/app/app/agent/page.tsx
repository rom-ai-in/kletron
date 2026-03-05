"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChatInput,
  Selector,
  WorkspaceLayout,
} from "@numezis/ui/components/design-system";
import { ProjectSidebar } from "@numezis/ui/components/CommandCenter/ProjectSidebar";
import type { SidebarProject, SidebarThread, ThreadLiveStatus } from "@numezis/ui/components/CommandCenter/ProjectSidebar";
import { AddWorkspaceModal } from "@numezis/ui/components/CommandCenter/AddWorkspaceModal";
import { TimelinePanel } from "@numezis/ui/components/Agent/TimelinePanel";
import { EventCard } from "@numezis/ui/components/Agent/EventCard";
import {
  TokenUsageDisplay,
  DurationDisplay,
} from "@numezis/ui/components/Agent/metrics";
import { useAgentSession } from "@numezis/ui/hooks/useAgentSession";
import { useSessionStream } from "@numezis/ui/hooks/useSessionStream";
import { useSessionEdits } from "@numezis/ui/hooks/useSessionEdits";
import { useWorkspace } from "@numezis/ui/context/WorkspaceContext";
import {
  Loader2,
  Folder,
  ClipboardCopy,
} from "lucide-react";

// For simple chat view - reuse existing components (groups tool events, renders collapsible tool cards)
import { MessageList, type ChatEvent } from "@numezis/ui/components/Agent/MessageList";
import { MessageQueue } from "@numezis/ui/components/CommandCenter/MessageQueue";
import type { QueuedMessageItem } from "@numezis/ui/components/CommandCenter/MessageQueue";

// ─── Types ──────────────────────────────────────────────────────────────────

type SessionSummary = {
  id: string;
  graphId: string;
  workspaceId: string | null;
  title: string;
  status: string;
  archived: boolean;
  conversationTurns: number;
  startedAt: string;
  endedAt: string | null;
};

type SessionDetail = {
  id: string;
  graphId: string;
  title: string;
  status: string;
  graph: {
    name: string;
    nodeCount: number;
    nodes: Array<{ id: string; label: string }>;
  } | null;
  conversationHistory: any[];
  nodeOrder: string[];
  nodeStatuses: Record<string, string>;
  tokenUsage: any;
};

const SESSION_STORAGE_KEY = "agent-active-session";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map server session status to ProjectSidebar's ThreadLiveStatus */
function toThreadLiveStatus(status: string, isStreaming: boolean): ThreadLiveStatus {
  if (isStreaming) return "running";
  switch (status) {
    case "RUNNING": return "running";
    case "COMPLETED": return "completed";
    case "FAILED": return "error";
    case "PAUSED": return "waiting";
    case "PENDING": return "waiting";
    case "CANCELLED": return "idle";
    default: return "idle";
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AgentPage() {
  // ── Read handoff params from BA Feature detail ────────────────────────
  const searchParams = useSearchParams();

  // ── State ─────────────────────────────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messageQueue, setMessageQueue] = useState<QueuedMessageItem[]>([]);
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);

  // ── Workspace context ──────────────────────────────────────────────────
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    error: workspaceError,
    switchWorkspace,
    refreshWorkspaces,
    deleteWorkspace: deleteWorkspaceCtx,
  } = useWorkspace();

  // ── Hooks ─────────────────────────────────────────────────────────────
  const {
    llmProvider,
    selectedGraphId,
    llmOptions,
    graphSelectOptions,
    handleLlmChange,
    handleGraphChange,
    llmStatus,
    graphOptionsLoaded,
    agentGraphs,
  } = useAgentSession();

  // Determine if the selected graph is single-node (simple chat) or multi-node (timeline)
  const isSimpleGraph = useMemo(() => {
    if (!selectedGraphId || !graphOptionsLoaded) return true;
    const agentGraph = agentGraphs.find(
      (g: any) => String(g._id) === selectedGraphId
    );
    if (agentGraph) {
      const nodeCount = (agentGraph as any).nodes?.length;
      // Default to simple chat when nodes are not defined or only 1 node
      return !nodeCount || nodeCount <= 1;
    }
    return true;
  }, [selectedGraphId, graphOptionsLoaded, agentGraphs]);

  // Active session's graph node count (from loaded session detail)
  const activeGraphIsSimple = useMemo(() => {
    if (sessionDetail?.graph) {
      const nc = sessionDetail.graph.nodeCount;
      // Default to simple chat when nodeCount is missing/undefined or <= 1
      return nc == null || nc <= 1;
    }
    return isSimpleGraph;
  }, [sessionDetail, isSimpleGraph]);

  // ── Fetch sessions (all workspaces) ─────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/sessions?limit=50&allWorkspaces=true&excludeSource=automation");
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const handleSessionCreated = useCallback((runId: string, _graphId: string) => {
    setActiveSessionId(runId);
    sessionStorage.setItem(SESSION_STORAGE_KEY, runId);
  }, []);

  const handleTitleGenerate = useCallback(async (runId: string, userMessage: string) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 1500;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`/api/sessions/${runId}/title`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generate: true, userMessage }),
        });
        if (res.ok) {
          await fetchSessions();
          return;
        }
        console.warn(`[title-gen] Attempt ${attempt + 1} returned ${res.status}`);
      } catch (e) {
        console.warn(`[title-gen] Attempt ${attempt + 1} failed:`, e);
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
    console.error("[title-gen] All retries exhausted for session", runId);
  }, [fetchSessions]);

  const {
    messages,
    setMessages,
    eventStream,
    timeline,
    input,
    setInput,
    sending,
    streamStatus,
    errorMessage,
    tokenUsage,
    runStartedAt,
    runEndedAt,
    handleSend,
    handleStop,
    handleKeyDown,
    formatTime,
    isAtBottomRef,
    streamingText,
    isStreaming,
  } = useSessionStream({
    sessionId: activeSessionId,
    selectedGraphId,
    llmProvider,
    workspaceId: activeWorkspaceId,
    onSessionCreated: handleSessionCreated,
    onTitleGenerate: handleTitleGenerate,
  });

  const {
    pendingEdits,
    approveEdit,
    rejectEdit,
    approveAll,
    rejectAll,
    approvingAll,
    rejectingAll,
  } = useSessionEdits({
    sessionId: activeSessionId,
    isStreaming: streamStatus === "streaming",
  });

  // ── Fetch session detail when active session changes ──────────────────
  const loadSessionDetail = useCallback(async (sessionId: string, options?: { mergeMessages?: boolean }) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetail(data);

        if (data.conversationHistory?.length) {
          // Deduplicate loaded messages by id — the server can store
          // duplicate events (e.g. `event-continue-*` vs `event-N` for
          // the same user message). We keep the last occurrence per id
          // and also deduplicate by role+content to handle ID mismatches.
          const rawMessages = data.conversationHistory
            .filter((e: any) => e.kind === "user" || e.kind === "assistant" || e.kind === "tool")
            .map((e: any) => ({
              id: e.id,
              role: e.kind === "tool" ? "tool" : e.kind,
              content: e.content ?? "",
              timestamp: e.timestamp,
              toolName: e.toolName ?? e.name,
              toolArgs: typeof e.toolArgs === "string" ? e.toolArgs : e.toolArgs ? JSON.stringify(e.toolArgs) : undefined,
              toolOutput: e.kind === "tool" ? e.content : undefined,
              toolCallId: e.toolCallId,
              thoughts: e.thoughts,
            }));

          // Dedup pass:
          // 1. Remove exact ID duplicates
          // 2. Remove consecutive same-role same-content messages (handles
          //    server-side duplicates where the same event is stored with
          //    different IDs or timestamps, e.g. assistant responses echoed
          //    multiple times by the agent loop)
          const seenIds = new Set<string>();
          const loadedMessages: typeof rawMessages = [];
          for (let i = 0; i < rawMessages.length; i++) {
            const m = rawMessages[i];
            if (seenIds.has(m.id)) continue;
            // Check for consecutive same-role same-content duplicates
            if (loadedMessages.length > 0) {
              const prev = loadedMessages[loadedMessages.length - 1];
              if (
                prev.role === m.role &&
                (prev.content ?? "").trim() === (m.content ?? "").trim() &&
                (prev.content ?? "").trim() !== "" // don't dedup empty messages
              ) {
                continue;
              }
            }
            seenIds.add(m.id);
            loadedMessages.push(m);
          }

          // When called after a stream ends (mergeMessages: true), prefer
          // whichever dataset is richer.  This protects against the server
          // returning stale/incomplete data for FAILED sessions where turn-2
          // events weren't persisted.  For normal loads (session switch,
          // initial page load) we always replace.
          // During active streaming the safe setter is a no-op anyway.
          if (options?.mergeMessages) {
            setMessages(prev => {
              if (prev.length > loadedMessages.length) return prev;
              return loadedMessages;
            });
          } else {
            setMessages(loadedMessages);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load session detail:", e);
    }
  }, [setMessages]);

  // ── Pre-fill from BA handoff (URL search params) ──────────────────────
  const handoffAppliedRef = useRef(false);
  useEffect(() => {
    if (handoffAppliedRef.current) return;
    const mission = searchParams?.get("mission");
    const goal = searchParams?.get("goal");
    const acceptanceCriteria = searchParams?.get("acceptanceCriteria");
    if (mission || goal) {
      handoffAppliedRef.current = true;
      const parts: string[] = [];
      if (mission) parts.push(mission);
      if (goal) parts.push(`\n\nGoal:\n${goal}`);
      if (acceptanceCriteria) parts.push(`\n\nAcceptance Criteria:\n${acceptanceCriteria}`);
      setInput(parts.join(""));
      // Clear search params from URL without navigation
      window.history.replaceState({}, "", "/app/agent");
    }
  }, [searchParams, setInput]);

  // ── Initialize ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSessions();
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      setActiveSessionId(stored);
    }
  }, [fetchSessions]);

  useEffect(() => {
    if (activeSessionId) {
      loadSessionDetail(activeSessionId);
      sessionStorage.setItem(SESSION_STORAGE_KEY, activeSessionId);
    }
  }, [activeSessionId, loadSessionDetail]);

  // Refresh sessions & reload session detail after stream completes.
  // The stream guard in useSessionStream prevents loadSessionDetail from
  // running mid-stream, so we reload once the stream is done to ensure
  // the final conversation history is synced.
  const prevStreamStatusRef = useRef<string>(streamStatus);
  useEffect(() => {
    const wasStreaming = prevStreamStatusRef.current === "streaming";
    prevStreamStatusRef.current = streamStatus;

    if (streamStatus !== "streaming" && activeSessionId) {
      fetchSessions();
      // Only reload detail when transitioning out of streaming
      // (avoids re-running on every "idle" render).
      // Use mergeMessages to keep the richer dataset — the stream may
      // have produced events the server hasn't persisted (FAILED runs).
      if (wasStreaming) {
        void loadSessionDetail(activeSessionId, { mergeMessages: true });
      }
    }
  }, [streamStatus, activeSessionId, fetchSessions, loadSessionDetail]);

  // Re-fetch sessions when active workspace changes (ensures sidebar stays current)
  const prevWorkspaceRef = useRef(activeWorkspaceId);
  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== prevWorkspaceRef.current) {
      prevWorkspaceRef.current = activeWorkspaceId;
      fetchSessions();
    }
  }, [activeWorkspaceId, fetchSessions]);

  // ── Session actions ───────────────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    // Stop any active stream before clearing state — this also releases
    // the streaming guard so setMessages will work.
    handleStop();
    setActiveSessionId(null);
    setSessionDetail(null);
    setMessages([]);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, [setMessages, handleStop]);

  /** Select a session and auto-switch to its owning workspace */
  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    // Auto-switch workspace if the session belongs to a different one
    const session = sessions.find((s) => s.id === id);
    if (session?.workspaceId && session.workspaceId !== activeWorkspaceId) {
      void switchWorkspace(session.workspaceId);
    }
  }, [sessions, activeWorkspaceId, switchWorkspace]);

  // Auto-switch workspace after sessions load for a restored session from sessionStorage
  const didAutoSwitchRef = useRef(false);
  useEffect(() => {
    if (didAutoSwitchRef.current || !activeSessionId || sessions.length === 0) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session?.workspaceId && session.workspaceId !== activeWorkspaceId) {
      didAutoSwitchRef.current = true;
      void switchWorkspace(session.workspaceId);
    }
  }, [activeSessionId, sessions, activeWorkspaceId, switchWorkspace]);

  const handleArchiveSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (activeSessionId === id) {
        handleNewSession();
      }
      await fetchSessions();
    } catch (e) {
      console.error("Failed to archive session:", e);
    }
  }, [activeSessionId, handleNewSession, fetchSessions]);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}?action=delete`, { method: "DELETE" });
      if (activeSessionId === id) {
        handleNewSession();
      }
      await fetchSessions();
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  }, [activeSessionId, handleNewSession, fetchSessions]);

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    try {
      await fetch(`/api/sessions/${id}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      await fetchSessions();
    } catch (e) {
      console.error("Failed to rename:", e);
    }
  }, [fetchSessions]);

  // ── Workspace actions ─────────────────────────────────────────────────

  /** Create a new session inside a specific workspace */
  const handleNewSessionInWorkspace = useCallback(async (workspaceId: string) => {
    if (workspaceId === "__unassigned__") return; // guard: synthetic group
    // Switch to the target workspace (optimistic update in context is immediate),
    // then start a fresh session
    await switchWorkspace(workspaceId);
    handleNewSession();
  }, [switchWorkspace, handleNewSession]);

  /** Open the add workspace modal */
  const handleAddWorkspace = useCallback(() => {
    setAddWorkspaceOpen(true);
  }, []);

  /** Called when a workspace is successfully created from the modal */
  const handleWorkspaceCreated = useCallback(async (ws: { id: string; name: string; rootPath: string }) => {
    await refreshWorkspaces();
    await switchWorkspace(ws.id);
    await fetchSessions();
  }, [refreshWorkspaces, switchWorkspace, fetchSessions]);

  /** Remove (archive) a workspace */
  const handleRemoveWorkspace = useCallback((workspaceId: string) => {
    if (workspaceId === "__unassigned__") return; // guard: synthetic group
    void deleteWorkspaceCtx(workspaceId);
  }, [deleteWorkspaceCtx]);

  // ── Build sidebar projects from workspaces + sessions ─────────────────
  const sidebarProjects: SidebarProject[] = useMemo(() => {
    const projects: SidebarProject[] = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      threads: sessions
        .filter((s) => s.workspaceId === ws.id)
        .map((s): SidebarThread => ({
          id: s.id,
          title: s.title || "Untitled",
          updatedAt: s.startedAt,
          liveStatus: toThreadLiveStatus(s.status, sending && activeSessionId === s.id),
        })),
    }));

    // Orphan sessions (no workspace or workspace not in user's list)
    const wsIds = new Set(workspaces.map((w) => w.id));
    const orphans = sessions.filter((s) => !s.workspaceId || !wsIds.has(s.workspaceId));
    if (orphans.length > 0) {
      projects.push({
        id: "__unassigned__",
        name: "Unassigned",
        readonly: true,
        threads: orphans.map((s): SidebarThread => ({
          id: s.id,
          title: s.title || "Untitled",
          updatedAt: s.startedAt,
          liveStatus: toThreadLiveStatus(s.status, sending && activeSessionId === s.id),
        })),
      });
    }

    return projects;
  }, [workspaces, sessions, sending, activeSessionId]);

  // Convert Message[] from useSessionStream to ChatEvent[] for MessageList
  // Includes a final consecutive-duplicate guard to catch any remaining dupes
  const chatEventsForView = useMemo<ChatEvent[]>(() => {
    const events: ChatEvent[] = [];
    for (const m of messages) {
      const evt: ChatEvent = {
        id: m.id,
        kind: m.role as ChatEvent["kind"],
        content: m.content,
        toolName: m.toolName,
        toolArgs: m.toolArgs,
        toolOutput: m.role === "tool" ? (m.toolOutput ?? m.content) : m.toolOutput,
        toolCallId: m.toolCallId,
        thoughts: m.thoughts,
        timestamp: m.timestamp,
      };
      // Skip consecutive same-kind same-content duplicates
      if (events.length > 0) {
        const prev = events[events.length - 1];
        if (
          prev.kind === evt.kind &&
          (prev.content ?? "").trim() === (evt.content ?? "").trim() &&
          (prev.content ?? "").trim() !== ""
        ) {
          continue;
        }
      }
      events.push(evt);
    }
    return events;
  }, [messages]);

  // ── Copy debug logs ──────────────────────────────────────────────────
  const [logsCopied, setLogsCopied] = useState(false);
  const handleCopyLogs = useCallback(() => {
    const debugState = {
      timestamp: new Date().toISOString(),
      activeSessionId,
      streamStatus,
      sending,
      isStreaming,
      errorMessage,
      messagesCount: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        contentLength: m.content?.length ?? 0,
        contentPreview: (m.content ?? "").slice(0, 120),
        toolName: m.toolName,
        timestamp: m.timestamp,
      })),
      eventStreamCount: eventStream.length,
      eventStream: eventStream.slice(0, 30).map((e) => ({
        id: e.id,
        kind: e.kind,
        contentLength: e.content?.length ?? 0,
        contentPreview: (e.content ?? "").slice(0, 120),
        name: e.name,
        timestamp: e.timestamp,
      })),
      activeGraphIsSimple,
      selectedGraphId,
      llmProvider,
      sessionDetail: sessionDetail ? {
        id: sessionDetail.id,
        graphId: sessionDetail.graphId,
        status: sessionDetail.status,
        graph: sessionDetail.graph,
        conversationHistoryCount: sessionDetail.conversationHistory?.length ?? 0,
      } : null,
      tokenUsage,
      runStartedAt,
      runEndedAt,
      timelineCount: timeline.length,
    };
    const text = JSON.stringify(debugState, null, 2);
    navigator.clipboard?.writeText(text).then(() => {
      setLogsCopied(true);
      setTimeout(() => setLogsCopied(false), 2000);
    }).catch((err) => {
      console.error("Failed to copy logs:", err);
    });
  }, [
    activeSessionId, streamStatus, sending, isStreaming, errorMessage,
    messages, eventStream, activeGraphIsSimple, selectedGraphId, llmProvider,
    sessionDetail, tokenUsage, runStartedAt, runEndedAt, timeline,
  ]);

  // Auto-scroll
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, eventStream, isAtBottomRef]);

  // ── Message Queue ─────────────────────────────────────────────────────

  const handleSendOrQueue = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    if (sending) {
      setMessageQueue((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
      ]);
      setInput("");
      return;
    }

    void handleSend();
  }, [input, sending, handleSend, setInput]);

  const sendTextDirectly = useCallback((text: string) => {
    void handleSend({ text });
  }, [handleSend]);

  const dequeueAndSend = useCallback(() => {
    setMessageQueue((prev) => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      setTimeout(() => sendTextDirectly(next.text), 0);
      return rest;
    });
  }, [sendTextDirectly]);

  const handleQueueEdit = useCallback((id: string, newText: string) => {
    setMessageQueue((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: newText } : m))
    );
  }, []);

  const handleQueueMoveUp = useCallback((id: string) => {
    setMessageQueue((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const handleQueueDelete = useCallback((id: string) => {
    setMessageQueue((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleQueueForceSend = useCallback(() => {
    handleStop();
    setTimeout(() => dequeueAndSend(), 120);
  }, [handleStop, dequeueAndSend]);

  const handleKeyDownWithQueue = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendOrQueue();
    }
  }, [handleSendOrQueue]);

  // Auto-dequeue
  const prevSendingRef = useRef(false);
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = sending;

    if (wasSending && !sending && messageQueue.length > 0) {
      setTimeout(() => dequeueAndSend(), 50);
    }
  }, [sending, messageQueue.length, dequeueAndSend]);

  // ── Pending edits panel ───────────────────────────────────────────────
  const pendingEditsPanel = pendingEdits.length > 0 ? (
    <div className="border-t border-border-subtle bg-bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Pending Edits ({pendingEdits.length})
        </h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => void approveAll()}
            disabled={approvingAll}
            className="px-2 py-1 text-[10px] rounded border border-status-success-border bg-status-success-bg text-status-success-text hover:opacity-80 disabled:opacity-50"
          >
            {approvingAll ? "Approving..." : "Approve All"}
          </button>
          <button
            onClick={() => void rejectAll()}
            disabled={rejectingAll}
            className="px-2 py-1 text-[10px] rounded border border-status-error-border bg-status-error-bg text-status-error-text hover:opacity-80 disabled:opacity-50"
          >
            {rejectingAll ? "Rejecting..." : "Reject All"}
          </button>
        </div>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {pendingEdits.map((edit) => (
          <div
            key={edit.id}
            className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px]"
          >
            <div className="flex-1 min-w-0 mr-2">
              <p className="font-mono text-text-primary truncate">{edit.toolName}</p>
              {edit.description && (
                <p className="text-text-muted truncate">{edit.description}</p>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => void approveEdit(edit.id)}
                className="px-1.5 py-0.5 rounded text-[10px] border border-status-success-border bg-status-success-bg text-status-success-text hover:opacity-80"
              >
                Approve
              </button>
              <button
                onClick={() => void rejectEdit(edit.id)}
                className="px-1.5 py-0.5 rounded text-[10px] border border-status-error-border bg-status-error-bg text-status-error-text hover:opacity-80"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────
  const sidebar = (
    <ProjectSidebar
      projects={sidebarProjects}
      activeThreadId={activeSessionId}
      activeProjectId={activeWorkspaceId}
      onThreadSelect={handleSelectSession}
      onNewThreadInProject={handleNewSessionInWorkspace}
      onAddProject={handleAddWorkspace}
      onRenameThread={(id, title) => void handleRenameSession(id, title)}
      onArchiveThread={(id) => void handleArchiveSession(id)}
      onDeleteThread={(id) => void handleDeleteSession(id)}
      onRemoveProject={handleRemoveWorkspace}
      className="w-full"
    />
  );

  const mainContent = (
    <div className="flex flex-col h-full">
      {/* Active workspace indicator + Token usage / duration header */}
      <div className="flex-none flex items-center justify-between gap-3 px-4 py-2 border-b border-border-subtle bg-bg-surface">
        {/* Left: workspace indicator */}
        {activeWorkspace ? (
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
            <span className="text-[11px] font-medium text-text-secondary truncate">
              {activeWorkspace.name}
            </span>
            <span className="text-[10px] text-text-muted truncate hidden sm:inline">
              {activeWorkspace.rootPath}
            </span>
          </div>
        ) : workspaceError ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-status-error-text">Failed to load workspaces</span>
            <button
              onClick={() => void refreshWorkspaces()}
              className="text-[10px] text-text-muted underline hover:text-text-primary"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-text-muted">No workspace selected</div>
        )}
        {/* Right: metrics + debug */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/app/config/tools"
            className="rounded border border-border-subtle bg-bg-elevated px-2 py-1 text-[10px] text-text-muted transition hover:bg-state-hover hover:text-text-primary"
            title="Manage tool catalog and policy"
          >
            Tools
          </Link>
          <Link
            href={selectedGraphId ? `/app/agent-graphs/${selectedGraphId}` : "/app/config/graphs"}
            className="rounded border border-border-subtle bg-bg-elevated px-2 py-1 text-[10px] text-text-muted transition hover:bg-state-hover hover:text-text-primary"
            title="Manage graph tool allowlist"
          >
            Graph
          </Link>
          {runStartedAt && tokenUsage && <TokenUsageDisplay tokenUsage={tokenUsage} />}
          {runStartedAt && <DurationDisplay startedAt={runStartedAt} endedAt={runEndedAt ?? undefined} />}
          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1 rounded border border-border-subtle bg-bg-elevated px-2 py-1 text-[10px] text-text-muted transition hover:bg-state-hover hover:text-text-primary"
            title="Copy debug logs to clipboard"
          >
            <ClipboardCopy className="h-3 w-3" />
            {logsCopied ? "Copied!" : "Logs"}
          </button>
        </div>
      </div>

      {/* Main content area - adaptive */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-elegant"
        onScroll={() => {
          if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
          }
        }}
      >
        {activeGraphIsSimple ? (
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <h2 className="text-lg font-semibold text-text-primary mb-2">Agent</h2>
                <p className="text-[13px] text-center max-w-md">
                  Start a conversation. Select a graph and LLM provider below, then send your message.
                </p>
              </div>
            )}
            {(messages.length > 0 || sending) && (
              <MessageList
                events={chatEventsForView}
                streaming={sending}
                streamingText={streamingText}
                className="overflow-visible flex-initial p-0 px-2 py-4"
                footer={<div ref={bottomRef} />}
              />
            )}
            {errorMessage && !sending && (
              <div className="mx-2 mb-4 rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-[12px] text-status-error-text">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-[11px] opacity-80">{errorMessage}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {eventStream.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <h2 className="text-lg font-semibold text-text-primary mb-2">Agent</h2>
                <p className="text-[13px] text-center max-w-md">
                  Select a multi-phase graph and send your mission to see the execution timeline.
                </p>
              </div>
            )}
            {eventStream
              .filter((e) => e.kind !== "system")
              .map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            {sending && eventStream.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[12px]">Executing...</span>
              </div>
            )}
            {errorMessage && !sending && (
              <div className="rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-[12px] text-status-error-text">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-[11px] opacity-80">{errorMessage}</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Pending edits panel */}
      {pendingEditsPanel}

      {/* Queued messages (visible when agent is busy) */}
      <MessageQueue
        messages={messageQueue}
        onEdit={handleQueueEdit}
        onMoveUp={handleQueueMoveUp}
        onDelete={handleQueueDelete}
        onForceSend={handleQueueForceSend}
        streaming={sending}
      />

      {/* Chat input */}
      <div className="flex-none border-t border-border-subtle bg-bg-surface px-4 py-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSendOrQueue}
          onStop={sending ? handleStop : undefined}
          onKeyDown={handleKeyDownWithQueue}
          sending={sending}
          placeholder={sending ? "Add a follow-up (queued until agent finishes)..." : "Ask anything…"}
          containerClassName="max-w-3xl mx-auto"
          footerLeft={
            <div className="flex items-center gap-2">
              <Selector
                label="GRAPH"
                value={selectedGraphId}
                options={graphSelectOptions}
                onSelect={handleGraphChange}
                size="sm"
                direction="up"
              />
              <Selector
                label="LLM"
                value={llmProvider}
                options={llmOptions}
                onSelect={handleLlmChange}
                size="sm"
                direction="up"
                status={llmStatus}
              />
            </div>
          }
        />
      </div>
    </div>
  );

  // Timeline sidebar (right side) for multi-node graphs
  const timelineSidebar = !activeGraphIsSimple && timeline.length > 0 ? (
    <TimelinePanel
      timeline={timeline}
      selectedEventId={null}
      onPhaseSelect={() => {}}
      tokenUsage={tokenUsage ?? undefined}
    />
  ) : undefined;

  return (
    <>
      <WorkspaceLayout
        sidebar={sidebar}
        content={mainContent}
        aside={timelineSidebar}
        sidebarWidth="w-[260px]"
        asideWidth="w-72"
      />
      <AddWorkspaceModal
        open={addWorkspaceOpen}
        onClose={() => setAddWorkspaceOpen(false)}
        onCreated={(ws) => void handleWorkspaceCreated(ws)}
      />
    </>
  );
}
