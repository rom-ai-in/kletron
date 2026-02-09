"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ChatInput,
  Selector,
  ThreadFeed,
  WorkspaceLayout,
  Modal,
} from "@numezis/ui/components/design-system";
import type { ThreadStatus } from "@numezis/ui/components/design-system";
import { TimelinePanel } from "@numezis/ui/components/Agent/TimelinePanel";
import { EventCard } from "@numezis/ui/components/Agent/EventCard";
import {
  TokenUsageDisplay,
  DurationDisplay,
} from "@numezis/ui/components/Agent/metrics";
import { useAgentSession } from "@numezis/ui/hooks/useAgentSession";
import { useSessionStream } from "@numezis/ui/hooks/useSessionStream";
import { useSessionEdits } from "@numezis/ui/hooks/useSessionEdits";
import {
  Loader2,
  Plus,
  RefreshCw,
  PencilLine,
  Check,
  X,
  Archive,
  Trash2,
} from "lucide-react";

// For simple chat view - reuse existing components (groups tool events, renders collapsible tool cards)
import { MessageList, type ChatEvent } from "@numezis/ui/components/Agent/MessageList";
import { MessageQueue } from "@numezis/ui/components/CommandCenter/MessageQueue";
import type { QueuedMessageItem } from "@numezis/ui/components/CommandCenter/MessageQueue";

// ─── Types ──────────────────────────────────────────────────────────────────

type SessionSummary = {
  id: string;
  graphId: string;
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

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AgentPage() {
  // ── State ─────────────────────────────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messageQueue, setMessageQueue] = useState<QueuedMessageItem[]>([]);

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
    llmPrefsLoaded,
    agentGraphs,
  } = useAgentSession();

  // Determine if the selected graph is single-node (simple chat) or multi-node (timeline)
  const isSimpleGraph = useMemo(() => {
    if (!selectedGraphId || !graphOptionsLoaded) return true;
    // Check agent graphs from DB
    const agentGraph = agentGraphs.find(
      (g: any) => String(g._id) === selectedGraphId
    );
    if (agentGraph) {
      return (agentGraph as any).nodes?.length === 1;
    }
    // For built-in graph options, check phases count
    return true; // Default to simple for built-in "universal-v1"
  }, [selectedGraphId, graphOptionsLoaded, agentGraphs]);

  // Active session's graph node count (from loaded session detail)
  const activeGraphIsSimple = useMemo(() => {
    if (sessionDetail?.graph) {
      return sessionDetail.graph.nodeCount <= 1;
    }
    return isSimpleGraph;
  }, [sessionDetail, isSimpleGraph]);

  const handleSessionCreated = useCallback((runId: string, _graphId: string) => {
    setActiveSessionId(runId);
    sessionStorage.setItem(SESSION_STORAGE_KEY, runId);
  }, []);

  const handleTitleGenerate = useCallback(async (runId: string, userMessage: string) => {
    try {
      const res = await fetch(`/api/sessions/${runId}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, userMessage }),
      });
      if (res.ok) {
        await fetchSessions();
      }
    } catch (e) {
      console.error("Failed to generate title:", e);
    }
  }, []);

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
  } = useSessionStream({
    sessionId: activeSessionId,
    selectedGraphId,
    llmProvider,
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

  // ── Fetch sessions ────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/sessions?limit=50");
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

  // ── Fetch session detail when active session changes ──────────────────
  const loadSessionDetail = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetail(data);

        // Load existing conversation history as messages for simple view
        if (data.conversationHistory?.length) {
          const loadedMessages = data.conversationHistory
            .filter((e: any) => e.kind === "user" || e.kind === "assistant" || e.kind === "tool")
            .map((e: any) => ({
              id: e.id,
              role: e.kind === "tool" ? "tool" : e.kind,
              content: e.content,
              timestamp: e.timestamp,
              // AgentEvent stores tool name in `name`, Message uses `toolName`
              toolName: e.toolName ?? e.name,
              toolArgs: typeof e.toolArgs === "string" ? e.toolArgs : e.toolArgs ? JSON.stringify(e.toolArgs) : undefined,
              toolOutput: e.kind === "tool" ? e.content : undefined,
              toolCallId: e.toolCallId,
              thoughts: e.thoughts,
            }));
          setMessages(loadedMessages);
        }
      }
    } catch (e) {
      console.error("Failed to load session detail:", e);
    }
  }, [setMessages]);

  // ── Initialize ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSessions();
    // Restore active session from sessionStorage
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

  // Refresh sessions list after stream completes
  useEffect(() => {
    if (streamStatus === "idle" && activeSessionId) {
      fetchSessions();
    }
  }, [streamStatus, activeSessionId, fetchSessions]);

  // ── Session actions ───────────────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setSessionDetail(null);
    setMessages([]);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, [setMessages]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

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

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    setRenameLoading(true);
    try {
      await fetch(`/api/sessions/${id}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setRenamingId(null);
      await fetchSessions();
    } catch (e) {
      console.error("Failed to rename:", e);
    } finally {
      setRenameLoading(false);
    }
  }, [fetchSessions]);

  // Convert Message[] from useSessionStream to ChatEvent[] for MessageList
  const chatEventsForView = useMemo<ChatEvent[]>(() => {
    return messages.map((m) => ({
      id: m.id,
      kind: m.role as ChatEvent["kind"],
      content: m.content,
      toolName: m.toolName,
      toolArgs: m.toolArgs,
      toolOutput: m.role === "tool" ? (m.toolOutput ?? m.content) : m.toolOutput,
      toolCallId: m.toolCallId,
      thoughts: m.thoughts,
      timestamp: m.timestamp,
    }));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, eventStream, isAtBottomRef]);

  // ── Message Queue ─────────────────────────────────────────────────────

  /** Wraps handleSend — queues if agent is busy, sends directly if idle */
  const handleSendOrQueue = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    if (sending) {
      // Queue the message
      setMessageQueue((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
      ]);
      setInput("");
      return;
    }

    void handleSend();
  }, [input, sending, handleSend, setInput]);

  /** Send a specific text directly (for dequeue). */
  const sendTextDirectly = useCallback((text: string) => {
    void handleSend({ text });
  }, [handleSend]);

  /** Dequeue and send the first queued message. */
  const dequeueAndSend = useCallback(() => {
    setMessageQueue((prev) => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      // Schedule send after state update
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

  /** Force-send: stop current stream, then send the next queued message. */
  const handleQueueForceSend = useCallback(() => {
    handleStop();
    setTimeout(() => dequeueAndSend(), 120);
  }, [handleStop, dequeueAndSend]);

  /** Keyboard handler — queues when streaming, sends when idle */
  const handleKeyDownWithQueue = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendOrQueue();
    }
  }, [handleSendOrQueue]);

  // Auto-dequeue: when stream finishes and there are queued messages, send next
  const prevSendingRef = useRef(false);
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = sending;

    if (wasSending && !sending && messageQueue.length > 0) {
      setTimeout(() => dequeueAndSend(), 50);
    }
  }, [sending, messageQueue.length, dequeueAndSend]);

  // ── Thread sidebar items ──────────────────────────────────────────────
  const threadItems = useMemo(() => {
    return sessions.map((s) => ({
      id: s.id,
      title: (
        renamingId === s.id ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              className="flex-1 bg-bg-elevated border border-border-strong rounded px-1.5 py-0.5 text-[12px] text-text-primary outline-none"
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleRenameSession(s.id, renamingValue);
                }
                if (e.key === "Escape") setRenamingId(null);
              }}
              autoFocus
            />
            <button
              onClick={() => void handleRenameSession(s.id, renamingValue)}
              className="text-status-success-text hover:text-text-primary"
              disabled={renameLoading}
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => setRenamingId(null)}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="truncate text-[12px]">{s.title}</span>
        )
      ),
      subtitle: (
        <span className="text-[10px] text-text-muted">
          {new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {s.conversationTurns > 1 && ` · ${s.conversationTurns} turns`}
        </span>
      ),
      status: (
        s.status === "RUNNING" ? "active" :
        s.status === "COMPLETED" ? "idle" :
        s.status === "FAILED" ? "idle" :
        "waiting"
      ) as ThreadStatus,
      actions: renamingId !== s.id ? (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenamingId(s.id);
              setRenamingValue(s.title);
            }}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover"
            title="Rename"
          >
            <PencilLine className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleArchiveSession(s.id);
            }}
            className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover"
            title="Archive"
          >
            <Archive className="h-3 w-3" />
          </button>
        </div>
      ) : undefined,
    }));
  }, [sessions, renamingId, renamingValue, renameLoading, handleRenameSession, handleArchiveSession]);

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
    <div className="flex flex-col h-full">
      <ThreadFeed
        title="Sessions"
        items={threadItems}
        activeId={activeSessionId ?? undefined}
        onSelect={handleSelectSession}
        headerAction={
          <div className="flex items-center gap-1">
            <button
              onClick={() => void fetchSessions()}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleNewSession}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover"
              title="New Session"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        }
        emptyState={
          <div className="flex flex-col items-center py-8 text-text-muted">
            <p className="text-[12px]">No sessions yet</p>
            <p className="text-[11px] mt-1">Start a conversation below</p>
          </div>
        }
      />
    </div>
  );

  const mainContent = (
    <div className="flex flex-col h-full">
      {/* Token usage / duration header */}
      {runStartedAt && (
        <div className="flex-none flex items-center justify-end gap-3 px-4 py-2 border-b border-border-subtle bg-bg-surface">
          {tokenUsage && <TokenUsageDisplay tokenUsage={tokenUsage} />}
          <DurationDisplay startedAt={runStartedAt} endedAt={runEndedAt ?? undefined} />
        </div>
      )}

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
          /* Simple Chat View — uses MessageList which groups tool events into
             collapsible ToolInvocation cards and renders assistant text with
             markdown + thoughts panels. */
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
            {/* Error banner */}
            {errorMessage && !sending && (
              <div className="mx-2 mb-4 rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-[12px] text-status-error-text">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-[11px] opacity-80">{errorMessage}</p>
              </div>
            )}
          </div>
        ) : (
          /* Timeline + Event Log View (multi-node) */
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
            {/* Error banner */}
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
    <WorkspaceLayout
      sidebar={sidebar}
      content={mainContent}
      aside={timelineSidebar}
      sidebarWidth="w-64"
      asideWidth="w-72"
    />
  );
}
