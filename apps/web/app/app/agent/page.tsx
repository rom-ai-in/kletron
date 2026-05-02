"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChatInput,
  ContextChips,
  createFileChip,
  Selector,
  WorkspaceLayout,
} from "@kletron/ui/components/design-system";
import type { ContextChip } from "@kletron/ui/components/design-system";
import { ProjectSidebar } from "@kletron/ui/components/CommandCenter/ProjectSidebar";
import type { SidebarProject, SidebarThread, ThreadLiveStatus } from "@kletron/ui/components/CommandCenter/ProjectSidebar";
import { AddWorkspaceModal } from "@kletron/ui/components/CommandCenter/AddWorkspaceModal";
import { TimelinePanel } from "@kletron/ui/components/Agent/TimelinePanel";
import { EventCard } from "@kletron/ui/components/Agent/EventCard";
import {
  TokenUsageDisplay,
  DurationDisplay,
} from "@kletron/ui/components/Agent/metrics";
import { useAgentSession } from "@kletron/ui/hooks/useAgentSession";
import { useSessionStream, normalizeMessage } from "@kletron/ui/hooks/useSessionStream";
import { useSessionEdits } from "@kletron/ui/hooks/useSessionEdits";

import { useMessageEdit } from "@kletron/ui/hooks/useMessageEdit";
import { MessageActions } from "@kletron/ui/components/Agent/MessageActions";
import { ReplayConfirmDialog } from "@kletron/ui/components/CommandCenter/ReplayConfirmDialog";
import { SlashCommandMenu } from "@kletron/ui/components/CommandCenter/SlashCommandMenu";
import type { SlashCommandItem } from "@kletron/ui/components/CommandCenter/SlashCommandMenu";
import { useSlashSkills } from "@kletron/ui/hooks/useSlashSkills";

import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { parseThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { ThreadApprovalModeSelector } from "@kletron/ui/components/Agent/ThreadApprovalModeSelector";
import { Modal, Button } from "@kletron/ui/components/design-system";
import {
  Loader2,
  ClipboardCopy,
  CheckCircle2,
  XCircle,
  Paperclip,
  Eye,
  Wrench,
  GitBranch,
} from "lucide-react";
import type { WorkModeId } from "@kletron/shared/workMode";
import { WORK_MODES, normalizeToWorkModeId } from "@kletron/shared/workMode";
import { AgentSessionChrome } from "@kletron/ui/components/CommandCenter/AgentSessionChrome";
import { AgentCodeRepoBar } from "../../../components/agent/AgentCodeRepoBar";

// For simple chat view - reuse existing components (groups tool events, renders collapsible tool cards)
import { MessageList, type ChatEvent } from "@kletron/ui/components/Agent/MessageList";
import { MessageQueue } from "@kletron/ui/components/CommandCenter/MessageQueue";
import type { QueuedMessageItem } from "@kletron/ui/components/CommandCenter/MessageQueue";

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
  /** Origin of the run: "agent" (chat) or "automation" (triggered run). */
  source?: string | null;
  /** When set, identifies the automation config this thread belongs to. */
  automationId?: string | null;
};

type SessionDetail = {
  id: string;
  graphId: string;
  title: string;
  status: string;
  threadApprovalMode?: ThreadApprovalMode;
  source?: string | null;
  startedAt?: string | null;
  graph: {
    name: string;
    nodeCount: number;
    nodes: Array<{ id: string; label: string }>;
  } | null;
  conversationHistory: any[];
  nodeOrder: string[];
  nodeStatuses: Record<string, string>;
  tokenUsage: any;
  conversationPagination?: {
    total: number;
    start: number;
    end: number;
    limit: number;
    hasOlder: boolean;
    hasNewer: boolean;
    nextBeforeIndex: number | null;
  };
};

const SESSION_STORAGE_KEY = "agent-active-session";

/** Append attachment labels to the outgoing message (API is text-only today). */
function augmentMessageWithFileChips(text: string, chips: ContextChip[]): string {
  const files = chips.filter((c) => c.variant === "file");
  if (files.length === 0) return text;
  const names = files.map((c) => c.label).join(", ");
  return `${text}\n\n(Attached for context: ${names})`;
}

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

interface AgentComposerProps {
  sending: boolean;
  onStop: () => void;
  onSendText: (text: string) => void;
  selectedGraphId: string;
  graphSelectOptions: any[];
  onGraphChange: (value: string) => void;
  llmProvider: string;
  llmOptions: any[];
  onLlmChange: (value: string) => void;
  llmStatus?: "none" | "loading" | "success" | "error";
  llmStatusDetail?: string | null;
  prefillText?: string | null;
  resetKey: string;
  perfDebugEnabled?: boolean;
  onInputLatencySample?: (ms: number) => void;
  editControl: ReturnType<typeof useMessageEdit>; // Added for editControl
  /** Server-side run in progress (e.g. automation) — same queued placeholder as streaming */
  runActive?: boolean;
  threadApprovalMode: ThreadApprovalMode;
  onThreadApprovalModeChange: (mode: ThreadApprovalMode) => void;
  threadApprovalLocked?: boolean;
  threadApprovalLockedReason?: string;
  activeWorkspaceId: string | null;
  planMode: boolean;
  onPlanModeToggle: () => void;
}

const AgentComposer = memo(function AgentComposer({
  sending,
  runActive = false,
  onStop,
  onSendText,
  selectedGraphId,
  graphSelectOptions,
  onGraphChange,
  llmProvider,
  llmOptions,
  onLlmChange,
  llmStatus,
  llmStatusDetail,
  prefillText,
  resetKey,
  perfDebugEnabled = false,
  onInputLatencySample,
  editControl, // Added for editControl
  threadApprovalMode,
  onThreadApprovalModeChange,
  threadApprovalLocked,
  threadApprovalLockedReason,
  activeWorkspaceId,
  planMode,
  onPlanModeToggle,
}: AgentComposerProps) {
  const router = useRouter();
  const queuedOrBusy = sending || runActive;
  const [draft, setDraft] = useState("");
  const [contextChips, setContextChips] = useState<ContextChip[]>([]);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSlashRequestHeaders = useCallback(async () => {
    const h: Record<string, string> = {};
    if (activeWorkspaceId) h["x-workspace-id"] = activeWorkspaceId;
    return h;
  }, [activeWorkspaceId]);

  const { skills: slashSkillRows } = useSlashSkills({
    apiOrigin: undefined,
    getRequestHeaders: getSlashRequestHeaders,
    enabled: true,
    workspaceId: activeWorkspaceId,
  });

  const slashCommands = useMemo((): SlashCommandItem[] => {
    const fromLibrary: SlashCommandItem[] = slashSkillRows.map((s) => ({
      id: `skill-${s.slug}`,
      sectionId: "skills",
      label: s.slug,
      description: s.description || undefined,
      action: () => setDraft(`/${s.slug} `),
    }));
    const builtin: SlashCommandItem[] = [
      {
        id: "plan",
        sectionId: "commands",
        label: "plan",
        description: "Toggle Plan Mode (read-only proposals)",
        icon: <Eye className="h-3.5 w-3.5" />,
        action: () => {
          setDraft("/plan ");
          onPlanModeToggle();
        },
      },
      {
        id: "skills",
        sectionId: "commands",
        label: "skills",
        description: "Open Skills library & settings",
        icon: <Wrench className="h-3.5 w-3.5" />,
        action: () => {
          setDraft("/skills ");
          queueMicrotask(() => {
            router.push("/app/config/skills");
          });
        },
      },
      {
        id: "worktree",
        sectionId: "commands",
        label: "worktree",
        description: "Workspace & repository settings",
        icon: <GitBranch className="h-3.5 w-3.5" />,
        action: () => {
          setDraft("/worktree ");
          queueMicrotask(() => {
            router.push("/app/config/workspace");
          });
        },
      },
    ];
    return [...fromLibrary, ...builtin];
  }, [slashSkillRows, onPlanModeToggle, router]);

  useEffect(() => {
    setDraft("");
  }, [resetKey]);

  useEffect(() => {
    if (prefillText && prefillText.trim()) {
      setDraft(prefillText);
    }
  }, [prefillText]);

  useEffect(() => {
    if (!draft.startsWith("/")) {
      setSlashMenuOpen(false);
    }
  }, [draft]);

  const onAttachFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setContextChips((prev) => {
      const add: ContextChip[] = [];
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        add.push(createFileChip(f.name, `${f.name}-${f.size}-${Date.now()}-${i}`));
      }
      return [...prev, ...add];
    });
    e.target.value = "";
  }, []);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    onSendText(augmentMessageWithFileChips(text, contextChips));
    setDraft("");
    setContextChips([]);
  }, [draft, contextChips, onSendText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (perfDebugEnabled) {
        const isEditingKey =
          e.key.length === 1 ||
          e.key === "Backspace" ||
          e.key === "Delete" ||
          e.key === "Enter";
        if (isEditingKey && onInputLatencySample) {
          const t0 = performance.now();
          requestAnimationFrame(() => {
            onInputLatencySample(performance.now() - t0);
          });
        }
      }
      if (draft === "" && e.key === "/") {
        setSlashMenuOpen(true);
        return;
      }
      if (
        slashMenuOpen &&
        (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey))
      ) {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [draft, handleSend, onInputLatencySample, perfDebugEnabled, slashMenuOpen]
  );

  return (
    <>
      {contextChips.length > 0 && (
        <div className="mx-auto mb-1.5 w-full max-w-3xl">
          <ContextChips
            chips={contextChips}
            onDismiss={(id) => setContextChips((p) => p.filter((c) => c.id !== id))}
            size="sm"
          />
        </div>
      )}
      <div className="relative mx-auto max-w-3xl">
        <SlashCommandMenu
          open={slashMenuOpen}
          onClose={() => setSlashMenuOpen(false)}
          commands={slashCommands}
          filter={draft}
        />
        <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onStop={sending ? onStop : undefined}
        onKeyDown={handleKeyDown}
        sending={sending}
        placeholder={
          planMode
            ? "Describe what you want to plan…"
            : queuedOrBusy
              ? "Add a follow-up (queued until agent finishes)..."
              : "Ask anything…"
        }
        containerClassName="w-full"
        leadingFooter={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onAttachFiles}
              aria-hidden
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-state-hover hover:text-text-primary"
              title="Attach files"
              aria-label="Attach files"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
          </>
        }
        sessionStrip={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Selector
              label="GRAPH"
              value={selectedGraphId}
              options={graphSelectOptions}
              onSelect={onGraphChange}
              size="sm"
              direction="up"
            />
            <Selector
              label="LLM"
              value={llmProvider}
              options={llmOptions}
              onSelect={onLlmChange}
              size="sm"
              direction="up"
              status={llmStatus}
              menuAlign="end"
              statusTooltip={llmStatusDetail}
            />
            <ThreadApprovalModeSelector
              value={threadApprovalMode}
              onSelect={onThreadApprovalModeChange}
              disabled={threadApprovalLocked}
              disabledReason={threadApprovalLockedReason}
            />
          </div>
        }
      />
      </div>

      {/* Replay Confirmation Dialog */}
      <ReplayConfirmDialog
        open={editControl.replayDialogOpen}
        impact={editControl.replayImpact}
        onConfirm={() => void editControl.executeReplay()}
        onCancel={editControl.cancelReplay}
        loading={editControl.editingMessageSaving}
      />
    </>
  );
});

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AgentPage() {
  // ── Read handoff params from BA Feature detail ────────────────────────
  const searchParams = useSearchParams();

  // ── State ─────────────────────────────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [threadApprovalMode, setThreadApprovalMode] = useState<ThreadApprovalMode>("inherit");
  const [fullAutoConfirmOpen, setFullAutoConfirmOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messageQueue, setMessageQueue] = useState<QueuedMessageItem[]>([]);
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState({
    total: 0,
    start: 0,
    end: 0,
    hasOlder: false,
  });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [perfDebugEnabled, setPerfDebugEnabled] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [inputLatencyStats, setInputLatencyStats] = useState<{ avg: number; p95: number; count: number }>({
    avg: 0,
    p95: 0,
    count: 0,
  });

  // ── Workspace context ────────────────────────────────────────────────────────────
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    switching: workspaceSwitching,
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
    llmStatusDetail,
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

  // ── Fetch sessions (current workspace only) ─────────────────────────
  // Includes both chat threads (source="agent") and automation threads
  // (source="automation"). The sidebar visually distinguishes them.
  const fetchSessions = useCallback(async () => {
    try {
      const wsQuery = activeWorkspaceId ? `&workspaceId=${activeWorkspaceId}` : '';
      const res = await fetch(`/api/sessions?limit=50${wsQuery}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    }
  }, [activeWorkspaceId]);

  const handleSessionCreated = useCallback((runId: string, _graphId: string) => {
    setActiveSessionId(runId);
    sessionStorage.setItem(SESSION_STORAGE_KEY, runId);
  }, []);

  const commitThreadApprovalMode = useCallback(
    async (mode: ThreadApprovalMode) => {
      setThreadApprovalMode(mode);
      if (!activeSessionId) return;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
        const res = await fetch(`/api/sessions/${activeSessionId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ threadApprovalMode: mode }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
      } catch (e) {
        console.error("[threadApprovalMode] PATCH failed:", e);
      }
    },
    [activeSessionId, activeWorkspaceId]
  );

  const onThreadApprovalSelect = useCallback(
    (mode: ThreadApprovalMode) => {
      if (mode === "full_auto_thread") {
        const key = `kletron-full-auto-thread-ok-${activeWorkspaceId ?? "default"}`;
        if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
          setFullAutoConfirmOpen(true);
          return;
        }
      }
      void commitThreadApprovalMode(mode);
    },
    [activeWorkspaceId, commitThreadApprovalMode]
  );

  const handleTitleGenerate = useCallback((runId: string, userMessage: string) => {
    void (async () => {
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
    })();
  }, [fetchSessions]);

  // ── Code vs Work mode (per workspace, persisted server + local mirror) ──
  const [workMode, setWorkMode] = useState<WorkModeId>("code");
  useEffect(() => {
    if (!activeWorkspaceId) {
      setWorkMode("code");
      return;
    }
    const lsKey = `kletron-work-mode-${activeWorkspaceId}`;
    const fromLs =
      typeof window !== "undefined" ? window.localStorage.getItem(lsKey) : null;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/work-categories/current?workspaceId=${encodeURIComponent(activeWorkspaceId)}`,
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: string | null };
          if (json.data != null && json.data !== "") {
            const m = normalizeToWorkModeId(String(json.data));
            if (!cancelled) {
              setWorkMode(m);
              try {
                window.localStorage.setItem(lsKey, m);
              } catch {
                /* ignore */
              }
            }
            return;
          }
        }
      } catch {
        /* fall through */
      }
      if (cancelled) return;
      if (fromLs === "code" || fromLs === "work") {
        setWorkMode(fromLs);
      } else {
        setWorkMode("code");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const {
    messages,
    setMessages,
    eventStream,
    timeline,
    sending,
    streamStatus,
    errorMessage,
    tokenUsage,
    runStartedAt,
    runEndedAt,
    handleSend,
    handleStop,
    isAtBottomRef,
    streamingText,
    streamingReasoning,
    isStreaming,
  } = useSessionStream({
    sessionId: activeSessionId,
    selectedGraphId,
    llmProvider,
    workspaceId: activeWorkspaceId,
    threadApprovalMode,
    onSessionCreated: handleSessionCreated,
    onTitleGenerate: handleTitleGenerate,
    workMode,
    planMode,
  });

  const truncateAndResend = useCallback(async (messageIndex: number, newContent: string) => {
    if (!activeSessionId) return;
    const res = await fetch(`/api/sessions/${activeSessionId}/truncate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afterIndex: messageIndex }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to truncate conversation (${res.status})`);
    }

    setMessages((prev) =>
      prev.filter((_, i) => i < messageIndex)
    );

    await handleSend({ text: newContent });
  }, [activeSessionId, handleSend, setMessages]);

  const {
    pendingEdits,
    processingOp,
    flushNotice,
    dismissFlushNotice,
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

  /** True while the primary GET /api/sessions/:id (replace load) is in flight — avoids onboarding empty-state flash. */
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const sessionHydrateSeqRef = useRef(0);

  // ── Fetch session detail when active session changes ──────────────────
  const loadSessionDetail = useCallback(async (
    sessionId: string,
    options?: { mergeMessages?: boolean; beforeIndex?: number; appendOlder?: boolean },
  ) => {
    const isReplaceLoad = !options?.mergeMessages && !options?.appendOlder;
    let seq = 0;
    if (isReplaceLoad) {
      seq = ++sessionHydrateSeqRef.current;
      setSessionDetailLoading(true);
    }
    try {
      const query = new URLSearchParams();
      query.set("limit", "120");
      if (typeof options?.beforeIndex === "number") {
        query.set("beforeIndex", String(options.beforeIndex));
      }
      const res = await fetch(`/api/sessions/${sessionId}?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetail(data);
        if (data?.conversationPagination) {
          if (options?.appendOlder) {
            setHistoryPage((prev) => ({
              total: data.conversationPagination.total ?? prev.total,
              start: data.conversationPagination.start ?? prev.start,
              end: Math.max(prev.end, data.conversationPagination.end ?? 0),
              hasOlder: Boolean(data.conversationPagination.hasOlder),
            }));
          } else {
            setHistoryPage({
              total: data.conversationPagination.total ?? 0,
              start: data.conversationPagination.start ?? 0,
              end: data.conversationPagination.end ?? 0,
              hasOlder: Boolean(data.conversationPagination.hasOlder),
            });
          }
        }

        if (data.conversationHistory?.length) {
          // Deduplicate loaded messages by id — the server can store
          // duplicate events (e.g. `event-continue-*` vs `event-N` for
          // the same user message). We keep the last occurrence per id
          // and also deduplicate by role+content to handle ID mismatches.
          const rawMessages = data.conversationHistory
            .filter((e: any) => e.kind === "user" || e.kind === "assistant" || e.kind === "tool")
            .map((e: any) => normalizeMessage({
              id: e.id,
              role: e.kind === "tool" ? "tool" : e.kind,
              content: e.content ?? "",
              timestamp: e.timestamp,
              toolName: e.toolName ?? e.name,
              toolArgs: typeof e.toolArgs === "string" ? e.toolArgs : e.toolArgs ? JSON.stringify(e.toolArgs) : undefined,
              toolOutput: e.kind === "tool" ? e.content : undefined,
              toolCallId: e.toolCallId,
              isError: e.isError,
              thoughts: e.thoughts,
              thinking: e.thinking,
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
          if (options?.appendOlder) {
            setMessages(prev => {
              const seen = new Set<string>(prev.map((m: any) => m.id));
              const olderUnique = loadedMessages.filter((m: any) => !seen.has(m.id));
              return [...olderUnique, ...prev];
            });
          } else if (options?.mergeMessages) {
            setMessages(prev => {
              if (prev.length > loadedMessages.length) return prev;
              return loadedMessages;
            });
          } else {
            setMessages(loadedMessages);
          }
        } else if (isReplaceLoad) {
          // Server returned no chat events yet (new run, or history not persisted). Clear
          // stale messages from a previous thread so we don't show wrong content.
          setMessages([]);
        }
      }
    } catch (e) {
      console.error("Failed to load session detail:", e);
    } finally {
      if (isReplaceLoad && seq === sessionHydrateSeqRef.current) {
        setSessionDetailLoading(false);
      }
    }
  }, [setMessages]);

  useEffect(() => {
    if (!sessionDetail?.id) return;
    setThreadApprovalMode(parseThreadApprovalMode(sessionDetail.threadApprovalMode));
  }, [sessionDetail?.id, sessionDetail?.threadApprovalMode]);

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
      setComposerPrefill(parts.join(""));
      // Clear search params from URL without navigation
      window.history.replaceState({}, "", "/app/agent");
    }
  }, [searchParams]);

  useEffect(() => {
    const perfParam = searchParams?.get("perf");
    if (perfParam === "1") setPerfDebugEnabled(true);
  }, [searchParams]);

  const initialBeforeIndexRef = useRef<number | null>(null);
  const beforeIndexAppliedForSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const raw = searchParams?.get("beforeIndex");
    if (!raw) {
      initialBeforeIndexRef.current = null;
      beforeIndexAppliedForSessionRef.current = null;
      return;
    }
    const parsed = Number(raw);
    initialBeforeIndexRef.current = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
    beforeIndexAppliedForSessionRef.current = null;
  }, [searchParams]);

  // ── Deep-link via ?sessionId=… ─────────────────────────────────────────
  // Used by automation Run buttons, history page and notifications to focus
  // a specific thread inside the agent UI.
  const sessionIdLinkRef = useRef<string | null>(null);
  useEffect(() => {
    const sessionIdParam = searchParams?.get("sessionId");
    if (!sessionIdParam || sessionIdLinkRef.current === sessionIdParam) return;
    sessionIdLinkRef.current = sessionIdParam;
    setActiveSessionId(sessionIdParam);
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionIdParam);
  }, [searchParams]);

  const inputLatencySamplesRef = useRef<number[]>([]);
  const handleInputLatencySample = useCallback((ms: number) => {
    const next = [...inputLatencySamplesRef.current, ms].slice(-120);
    inputLatencySamplesRef.current = next;
    const avg = next.reduce((acc, v) => acc + v, 0) / Math.max(next.length, 1);
    const sorted = [...next].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    setInputLatencyStats({ avg, p95, count: next.length });
  }, []);

  useEffect(() => {
    if (!perfDebugEnabled) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [perfDebugEnabled]);

  // ── Initialize ────────────────────────────────────────────────────────
  useEffect(() => {
    void fetchSessions();
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      setActiveSessionId(stored);
    }
  }, [fetchSessions]);

  useEffect(() => {
    if (activeSessionId) {
      const shouldApplyBeforeIndex = beforeIndexAppliedForSessionRef.current !== activeSessionId;
      const beforeIndex = shouldApplyBeforeIndex ? initialBeforeIndexRef.current ?? undefined : undefined;
      beforeIndexAppliedForSessionRef.current = activeSessionId;
      void loadSessionDetail(activeSessionId, { beforeIndex });
      sessionStorage.setItem(SESSION_STORAGE_KEY, activeSessionId);
    }
  }, [activeSessionId, loadSessionDetail]);

  // Server-side runs (e.g. automations) stream only on the server — poll until the run finishes
  // so the chat fills in without relying on the browser NDJSON stream.
  useEffect(() => {
    if (!activeSessionId || !sessionDetail || sessionDetail.id !== activeSessionId) return;
    if (sending) return;
    const status = sessionDetail.status;
    if (status !== "RUNNING" && status !== "PENDING") return;

    const id = window.setInterval(() => {
      void loadSessionDetail(activeSessionId, { mergeMessages: true });
    }, 2000);
    return () => window.clearInterval(id);
  }, [activeSessionId, sessionDetail?.id, sessionDetail?.status, sending, loadSessionDetail]);

  useEffect(() => {
    if (!activeSessionId) return;
    const url = new URL(window.location.href);
    if (historyPage.start > 0) {
      url.searchParams.set("beforeIndex", String(historyPage.end));
    } else {
      url.searchParams.delete("beforeIndex");
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [activeSessionId, historyPage.start, historyPage.end]);

  // Refresh sessions & reload session detail after stream completes.
  // The stream guard in useSessionStream prevents loadSessionDetail from
  // running mid-stream, so we reload once the stream is done to ensure
  // the final conversation history is synced.
  const prevStreamStatusRef = useRef<string>(streamStatus);
  useEffect(() => {
    const wasStreaming = prevStreamStatusRef.current === "streaming";
    prevStreamStatusRef.current = streamStatus;

    if (streamStatus !== "streaming" && activeSessionId) {
      void fetchSessions();
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
  // Only clear the current session when the switch was user-initiated
  // (workspaceSwitching=true). Passive refreshWorkspaces polling should NOT
  // clear the active session — this prevents the desktop app's workspace
  // changes from nuking the web app's conversation mid-flow.
  const prevWorkspaceRef = useRef(activeWorkspaceId);
  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== prevWorkspaceRef.current) {
      prevWorkspaceRef.current = activeWorkspaceId;
      if (workspaceSwitching) {
        // Explicit user-initiated switch — clear stale session
        handleStop();
        setActiveSessionId(null);
        setSessionDetail(null);
        setMessages([]);
        setHistoryPage({ total: 0, start: 0, end: 0, hasOlder: false });
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setSessionDetailLoading(false);
      }
      void fetchSessions();
    }
  }, [activeWorkspaceId, workspaceSwitching, fetchSessions, handleStop, setMessages]);

  // ── Session actions ───────────────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    // Stop any active stream before clearing state — this also releases
    // the streaming guard so setMessages will work.
    handleStop();
    setActiveSessionId(null);
    setSessionDetail(null);
    setMessages([]);
    setHistoryPage({ total: 0, start: 0, end: 0, hasOlder: false });
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionDetailLoading(false);
  }, [setMessages, handleStop]);

  /** Switching Code ↔ Work starts a fresh thread so messages stay scoped to the mode. */
  const handleWorkModeSelect = useCallback(
    async (categoryId: string) => {
      const next = normalizeToWorkModeId(categoryId) as WorkModeId;
      const prev = workMode;
      if (next === prev) return;

      handleNewSession();

      setWorkMode(next);
      const lsKey = activeWorkspaceId ? `kletron-work-mode-${activeWorkspaceId}` : null;
      if (lsKey) {
        try {
          window.localStorage.setItem(lsKey, next);
        } catch {
          /* ignore */
        }
      }
      try {
        const res = await fetch("/api/work-categories/current", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workMode: next,
            workspaceId: activeWorkspaceId ?? undefined,
          }),
        });
        if (!res.ok) throw new Error("persist failed");
      } catch {
        setWorkMode(prev);
        if (lsKey) {
          try {
            window.localStorage.setItem(lsKey, prev);
          } catch {
            /* ignore */
          }
        }
      }
    },
    [workMode, activeWorkspaceId, handleNewSession],
  );

  const handleLoadOlderMessages = useCallback(async () => {
    if (!activeSessionId || loadingOlder || !historyPage.hasOlder) return;
    setLoadingOlder(true);
    try {
      await loadSessionDetail(activeSessionId, {
        beforeIndex: historyPage.start,
        appendOlder: true,
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [activeSessionId, loadingOlder, historyPage.hasOlder, historyPage.start, loadSessionDetail]);

  /** Select a session and auto-switch to its owning workspace */
  const handleSelectSession = useCallback((id: string) => {
    // Auto-switch workspace if the session belongs to a different one
    const session = sessions.find((s) => s.id === id);
    if (session?.workspaceId && session.workspaceId !== activeWorkspaceId) {
      const ws = workspaces.find((w) => w.id === session.workspaceId);
      const isHealthy = !ws || !ws.health || ws.health === "healthy";
      if (!isHealthy) {
        console.warn("Cannot select session from an unhealthy workspace");
        return;
      }
      void switchWorkspace(session.workspaceId);
    }
    setActiveSessionId(id);
  }, [sessions, activeWorkspaceId, switchWorkspace, workspaces]);

  // Auto-switch workspace after sessions load for a restored session from sessionStorage
  const didAutoSwitchRef = useRef(false);
  useEffect(() => {
    if (didAutoSwitchRef.current || !activeSessionId || sessions.length === 0) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session?.workspaceId && session.workspaceId !== activeWorkspaceId) {
      const ws = workspaces.find((w) => w.id === session.workspaceId);
      const isHealthy = !ws || !ws.health || ws.health === "healthy";
      if (!isHealthy) {
        console.warn("Skipping auto-switch to unhealthy workspace");
        didAutoSwitchRef.current = true;
        return;
      }
      didAutoSwitchRef.current = true;
      void switchWorkspace(session.workspaceId);
    }
  }, [activeSessionId, sessions, activeWorkspaceId, switchWorkspace, workspaces]);

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

  /** Create a new session in the currently active workspace */
  const handleNewSessionInActiveWorkspace = useCallback(async () => {
    // Workspace scoping is handled on the server from the active workspace
    // selected in the global header.
    handleNewSession();
  }, [handleNewSession]);

  // Convert Message[] from useSessionStream to ChatEvent[] for MessageList
  // Includes a final consecutive-duplicate guard to catch any remaining dupes
  const chatEventsForView = useMemo<ChatEvent[]>(() => {
    const events: ChatEvent[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const evt: ChatEvent = {
        id: m.id,
        kind: m.role as ChatEvent["kind"],
        content: m.content,
        toolName: m.toolName,
        toolArgs: m.toolArgs,
        toolOutput: m.role === "tool" ? (m.toolOutput ?? m.content) : m.toolOutput,
        toolCallId: m.toolCallId,
        isError: m.isError,
        thoughts: m.thoughts,
        thinking: m.thinking,
        timestamp: m.timestamp,
        metadata: (m as any).metadata,
        messageIndex: (m.role === 'user' || m.role === 'assistant') ? i : undefined,
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
  const deferredChatEvents = useDeferredValue(chatEventsForView);

  /** Automations and other server-only runs never open a browser NDJSON stream (`sending` stays false). */
  const isServerSideRunActive = useMemo(() => {
    if (!activeSessionId || !sessionDetail || sessionDetail.id !== activeSessionId) return false;
    const st = sessionDetail.status;
    return st === "RUNNING" || st === "PENDING";
  }, [activeSessionId, sessionDetail]);

  const agentBusy = sending || isServerSideRunActive;

  /** Live stream events; for server runs fall back to persisted chat so the activity line can show tool names. */
  const activityEventsForStrip = useMemo(
    () => (eventStream.length > 0 ? eventStream : deferredChatEvents),
    [eventStream, deferredChatEvents],
  );

  const runStartedAtForUi = runStartedAt ?? sessionDetail?.startedAt ?? null;

  // ── Build sidebar project from active workspace + its sessions ───────
  const sidebarProjects: SidebarProject[] = useMemo(() => {
    if (!activeWorkspace) return [];
    const threadsForWorkspace = sessions
      .filter((s) => s.workspaceId === activeWorkspace.id)
      .map((s): SidebarThread => ({
        id: s.id,
        title: s.title || "Untitled",
        updatedAt: s.startedAt,
        liveStatus: toThreadLiveStatus(
          s.status,
          activeSessionId === s.id && (sending || isServerSideRunActive),
        ),
        category: s.source === "automation" || s.automationId ? "automation" : "chat",
      }));
    return [
      {
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        health: activeWorkspace.health,
        healthMessage: activeWorkspace.healthMessage,
        selectable: activeWorkspace.selectable,
        threads: threadsForWorkspace,
      },
    ];
  }, [activeWorkspace, sessions, sending, activeSessionId, isServerSideRunActive]);

  const editControl = useMessageEdit({
    sessionId: activeSessionId,
    events: chatEventsForView,
    streaming: agentBusy,
    onTruncateAndResend: truncateAndResend,
  });

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

  const handleSendOrQueueText = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized) return;

    if (sending) {
      setMessageQueue((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: normalized, createdAt: new Date().toISOString() },
      ]);
      return;
    }

    void handleSend({ text: normalized });
  }, [sending, handleSend]);

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

  // Auto-dequeue
  const prevSendingRef = useRef(false);
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = sending;

    if (wasSending && !sending && messageQueue.length > 0) {
      setTimeout(() => dequeueAndSend(), 50);
    }
  }, [sending, messageQueue.length, dequeueAndSend]);

  // ── Pending edits panel — same horizontal measure as MessageList / ChatInput (max-w-3xl) ──
  const showPendingStrip =
    pendingEdits.length > 0 || flushNotice !== null;
  const pendingEditsPanel = showPendingStrip ? (
    <div className="flex-none border-t border-white/[0.06] bg-transparent">
      <div className="mx-auto w-full max-w-3xl px-2 py-3">
      {flushNotice && (
        <div
          className={`mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${
            flushNotice.kind === "rejected" || flushNotice.kind === "rejected_all"
              ? "border-status-error-border bg-status-error-bg/30 text-status-error-text"
              : "border-status-success-border bg-status-success-bg/30 text-status-success-text"
          }`}
        >
          {flushNotice.kind === "rejected" || flushNotice.kind === "rejected_all" ? (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 opacity-90" aria-hidden />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 opacity-90" aria-hidden />
          )}
          <p className="flex-1 min-w-0 leading-snug">
            {flushNotice.kind === "approved" && (
              <>
                Approved <span className="font-mono">{flushNotice.toolName}</span>. The run continues in the thread above.
              </>
            )}
            {flushNotice.kind === "rejected" && (
              <>
                Rejected <span className="font-mono">{flushNotice.toolName}</span>.
              </>
            )}
            {flushNotice.kind === "approved_all" && (
              <>
                Approved {flushNotice.count} pending action{flushNotice.count === 1 ? "" : "s"}. The run continues in the thread above.
              </>
            )}
            {flushNotice.kind === "rejected_all" && (
              <>
                Rejected {flushNotice.count} pending action{flushNotice.count === 1 ? "" : "s"}.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => dismissFlushNotice()}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {pendingEdits.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted min-w-0">
              Pending actions ({pendingEdits.length})
            </h3>
            <div className="flex flex-shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => void approveAll()}
                disabled={approvingAll || rejectingAll}
                className="px-2 py-1 text-[10px] rounded border border-status-success-border bg-status-success-bg text-status-success-text hover:opacity-80 disabled:opacity-50"
              >
                {approvingAll ? "Approving..." : "Approve All"}
              </button>
              <button
                type="button"
                onClick={() => void rejectAll()}
                disabled={approvingAll || rejectingAll}
                className="px-2 py-1 text-[10px] rounded border border-status-error-border bg-status-error-bg text-status-error-text hover:opacity-80 disabled:opacity-50"
              >
                {rejectingAll ? "Rejecting..." : "Reject All"}
              </button>
            </div>
          </div>
          <div className="space-y-1 max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain">
            {pendingEdits.map((edit) => {
              const busy = processingOp?.editId === edit.id;
              const approvingThis = busy && processingOp?.op === "approve";
              const rejectingThis = busy && processingOp?.op === "reject";
              const desc = edit.description?.trim();
              const title = [edit.toolName, desc, edit.lastError].filter(Boolean).join(" · ");
              return (
                <div
                  key={edit.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-bg-elevated px-2 py-1 text-[10px] leading-none"
                >
                  <p
                    className="min-w-0 flex-1 truncate text-text-primary"
                    title={title}
                  >
                    <span className="font-mono text-text-primary">{edit.toolName}</span>
                    {desc ? (
                      <span className="text-text-muted"> · {desc}</span>
                    ) : null}
                    {edit.lastError ? (
                      <span className="text-status-error-text"> · {edit.lastError}</span>
                    ) : null}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void approveEdit(edit.id, edit.toolName)}
                      disabled={busy || approvingAll || rejectingAll}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] border border-status-success-border bg-status-success-bg text-status-success-text hover:opacity-80 disabled:opacity-50"
                    >
                      {approvingThis ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                          <span>Approving…</span>
                        </>
                      ) : (
                        "Approve"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void rejectEdit(edit.id, edit.toolName)}
                      disabled={busy || approvingAll || rejectingAll}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] border border-status-error-border bg-status-error-bg text-status-error-text hover:opacity-80 disabled:opacity-50"
                    >
                      {rejectingThis ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                          <span>Rejecting…</span>
                        </>
                      ) : (
                        "Reject"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      </div>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────
  const sidebar = (
    <ProjectSidebar
      projects={sidebarProjects}
      activeThreadId={activeSessionId}
      activeProjectId={activeWorkspaceId}
      loading={workspaceSwitching}
      onThreadSelect={handleSelectSession}
      onNewThreadInProject={() => { void handleNewSessionInActiveWorkspace(); }}
      onRenameThread={(id, title) => void handleRenameSession(id, title)}
      onArchiveThread={(id) => void handleArchiveSession(id)}
      onDeleteThread={(id) => void handleDeleteSession(id)}
      surface="solid"
      className="w-full min-h-0"
    />
  );

  const memoSidebar = useMemo(() => sidebar, [
    sidebarProjects,
    activeSessionId,
    activeWorkspaceId,
    workspaceSwitching,
    handleSelectSession,
    handleNewSessionInActiveWorkspace,
    handleRenameSession,
    handleArchiveSession,
    handleDeleteSession,
  ]);

  const mainContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <AgentSessionChrome
        workMode={workMode}
        onWorkModeChange={(mode) => void handleWorkModeSelect(mode)}
        workspaceName={activeWorkspace?.name ?? null}
        workspaceRootPath={activeWorkspace?.rootPath ?? null}
        workspaceErrorSlot={
          workspaceError ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-status-error-text">Failed to load workspaces</span>
              <button
                type="button"
                onClick={() => void refreshWorkspaces()}
                className="text-[10px] text-text-muted underline hover:text-text-primary"
              >
                Retry
              </button>
            </div>
          ) : undefined
        }
        trailing={
          <>
            {workMode === "code" && activeWorkspaceId ? (
              <AgentCodeRepoBar workspaceId={activeWorkspaceId} />
            ) : null}
            <Link
              href="/app/config/tools"
              className="rounded border border-white/[0.08] bg-bg-elevated px-2 py-1 text-[10px] text-text-muted transition hover:bg-state-hover hover:text-text-primary"
              title="Manage tool catalog and policy"
            >
              Tools
            </Link>
            <Link
              href={selectedGraphId ? `/app/agent-graphs/${selectedGraphId}` : "/app/agent-graphs"}
              className="rounded border border-white/[0.08] bg-bg-elevated px-2 py-1 text-[10px] text-text-muted transition hover:bg-state-hover hover:text-text-primary"
              title="Manage graph tool allowlist"
            >
              Graph
            </Link>
            {runStartedAt && tokenUsage && <TokenUsageDisplay tokenUsage={tokenUsage} />}
            {runStartedAt && <DurationDisplay startedAt={runStartedAt} endedAt={runEndedAt ?? undefined} />}
            <button
              type="button"
              onClick={() => setPerfDebugEnabled((v) => !v)}
              className={`rounded border px-2 py-1 text-[10px] transition ${perfDebugEnabled
                ? "border-status-info-border bg-status-info-bg text-status-info-text"
                : "border-white/[0.08] bg-bg-elevated text-text-muted hover:bg-state-hover hover:text-text-primary"
                }`}
              title="Toggle performance debug metrics"
            >
              Perf {perfDebugEnabled ? "ON" : "OFF"}
            </button>
            {perfDebugEnabled && (
              <div className="rounded border border-white/[0.08] bg-bg-elevated px-2 py-1 text-[10px] text-text-muted">
                FPS: {fps ?? "…"} | input p95: {inputLatencyStats.p95.toFixed(1)}ms | avg: {inputLatencyStats.avg.toFixed(1)}ms
              </div>
            )}
            <button
              type="button"
              onClick={handleCopyLogs}
              className="flex items-center gap-1 rounded border border-white/[0.08] bg-bg-elevated px-2 py-1 text-[10px] text-text-muted transition hover:bg-state-hover hover:text-text-primary"
              title="Copy debug logs to clipboard"
            >
              <ClipboardCopy className="h-3 w-3" />
              {logsCopied ? "Copied!" : "Logs"}
            </button>
          </>
        }
      />

      {/* Error snackbar - always visible at top when there's an error */}
      {errorMessage && !sending && (
        <div className="flex-none mx-4 mt-2 mb-1 rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-[12px] text-status-error-text shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Error</p>
              <p className="mt-1 text-[11px] opacity-90 break-words">{errorMessage}</p>
            </div>
            <button
              onClick={() => handleSend()}
              className="flex-shrink-0 px-2 py-1 text-[10px] rounded border border-status-error-border hover:bg-status-error-text hover:text-white transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main content area - adaptive */}
      <div
        ref={scrollContainerRef}
        className={activeGraphIsSimple ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto scrollbar-elegant"}
        onScroll={
          activeGraphIsSimple
            ? undefined
            : () => {
              if (scrollContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
              }
            }
        }
      >
        {activeGraphIsSimple ? (
          <div className="max-w-3xl mx-auto h-full min-h-0 flex flex-col">
            {workspaceSwitching ? (
              /* Skeleton loading state while workspace is switching */
              <div className="max-w-3xl mx-auto px-2 py-8 space-y-6 animate-pulse">
                {/* Skeleton user message */}
                <div className="flex justify-end">
                  <div className="h-10 w-3/5 rounded-xl bg-bg-elevated" />
                </div>
                {/* Skeleton assistant response */}
                <div className="space-y-2">
                  <div className="h-4 w-4/5 rounded bg-bg-elevated" />
                  <div className="h-4 w-3/4 rounded bg-bg-elevated" />
                  <div className="h-4 w-2/3 rounded bg-bg-elevated" />
                </div>
                {/* Skeleton tool call */}
                <div className="h-16 w-full rounded-lg bg-bg-elevated" />
                {/* Skeleton assistant response */}
                <div className="space-y-2">
                  <div className="h-4 w-5/6 rounded bg-bg-elevated" />
                  <div className="h-4 w-3/5 rounded bg-bg-elevated" />
                </div>
              </div>
            ) : sessionDetailLoading && activeSessionId ? (
              <div className="max-w-3xl mx-auto px-2 py-8 space-y-6 animate-pulse">
                <div className="flex justify-end">
                  <div className="h-10 w-3/5 rounded-xl bg-bg-elevated" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-4/5 rounded bg-bg-elevated" />
                  <div className="h-4 w-3/4 rounded bg-bg-elevated" />
                </div>
              </div>
            ) : messages.length === 0 && !sending && !isServerSideRunActive && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <h2 className="text-lg font-semibold text-text-primary mb-2">Agent</h2>
                <p className="text-[13px] text-center max-w-md">
                  {workMode === "code"
                    ? "Code mode: pick a graph and model, then ask for repo changes, reviews, or Git help."
                    : "Work mode: pick a graph and model for research, drafting, and planning—without repo-first defaults."}{" "}
                  Use the Mode control above to switch.
                </p>
              </div>
            )}
            {(messages.length > 0 || agentBusy) && (
              <MessageList
                events={deferredChatEvents}
                streaming={agentBusy}
                streamingText={streamingText}
                streamingReasoning={streamingReasoning}
                activityEvents={activityEventsForStrip}
                runStartedAt={runStartedAtForUi}
                maxVisibleEvents={320}
                hasOlder={historyPage.hasOlder}
                loadingOlder={loadingOlder}
                onLoadOlder={handleLoadOlderMessages}
                virtualized
                prefetchNearTop
                onNearTop={handleLoadOlderMessages}
                className="flex-1 min-h-0 p-0 px-2 py-4"
                messageActions={(event) => (
                  <MessageActions
                    event={event}
                    onStartEdit={() => editControl.startEditMessage(event.messageIndex!, event.content ?? "")}
                  />
                )}
                editingMessageIndex={editControl.editingMessageIndex}
                editingMessageDraft={editControl.editingMessageDraft}
                editingMessageSaving={editControl.editingMessageSaving}
                editingMessageError={editControl.editingMessageError}
                onEditDraftChange={(draft) => editControl.setEditingMessageDraft(draft)}
                onCancelEdit={editControl.cancelEditMessage}
                onResendEdit={editControl.handleResendEdit}
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
            {eventStream.length === 0 && !sending && !isServerSideRunActive && !(sessionDetailLoading && activeSessionId) && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <h2 className="text-lg font-semibold text-text-primary mb-2">Agent</h2>
                <p className="text-[13px] text-center max-w-md">
                  Select a multi-phase graph and send your mission to see the execution timeline.
                </p>
              </div>
            )}
            {eventStream.length === 0 && !sending && sessionDetailLoading && activeSessionId && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-muted">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-[13px]">Loading thread…</p>
              </div>
            )}
            {eventStream
              .filter((e) => e.kind !== "system")
              .map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            {(sending || isServerSideRunActive) && (
              <div className="flex items-center gap-2 px-1 py-2 text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span className="text-[12px]">{sending ? "Executing…" : "Run in progress…"}</span>
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

      {/* Queued messages — align width with thread + composer */}
      <MessageQueue
        messages={messageQueue}
        onEdit={handleQueueEdit}
        onMoveUp={handleQueueMoveUp}
        onDelete={handleQueueDelete}
        onForceSend={handleQueueForceSend}
        streaming={agentBusy}
        className="mx-auto w-full max-w-3xl"
      />

      {/* Chat input */}
      <div className="flex-none px-4 pb-3 pt-1">
        <AgentComposer
          sending={sending}
          runActive={isServerSideRunActive}
          onStop={handleStop}
          onSendText={handleSendOrQueueText}
          selectedGraphId={selectedGraphId}
          graphSelectOptions={graphSelectOptions}
          onGraphChange={handleGraphChange}
          llmProvider={llmProvider}
          llmOptions={llmOptions}
          onLlmChange={handleLlmChange}
          llmStatus={llmStatus}
          llmStatusDetail={llmStatusDetail}
          prefillText={composerPrefill}
          resetKey={activeSessionId ?? "new-session"}
          perfDebugEnabled={perfDebugEnabled}
          onInputLatencySample={handleInputLatencySample}
          editControl={editControl}
          threadApprovalMode={threadApprovalMode}
          onThreadApprovalModeChange={onThreadApprovalSelect}
          threadApprovalLocked={sessionDetail?.source === "automation"}
          threadApprovalLockedReason="Approval mode is fixed for automation threads."
          activeWorkspaceId={activeWorkspaceId}
          planMode={planMode}
          onPlanModeToggle={() => setPlanMode((p) => !p)}
        />
      </div>
    </div>
  );

  // Timeline sidebar (right side) for multi-node graphs
  const timelineSidebar = !activeGraphIsSimple && timeline.length > 0 ? (
    <TimelinePanel
      timeline={timeline}
      selectedEventId={null}
      onPhaseSelect={() => { }}
      tokenUsage={tokenUsage ?? undefined}
    />
  ) : undefined;

  return (
    <>
      <Modal
        open={fullAutoConfirmOpen}
        onClose={() => setFullAutoConfirmOpen(false)}
        title="Full auto in this chat"
        subtitle="Tools will run without asking, including file writes and shell commands. Kletron admin actions and your workspace blocklist still require approval."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFullAutoConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const key = `kletron-full-auto-thread-ok-${activeWorkspaceId ?? "default"}`;
                sessionStorage.setItem(key, "1");
                setFullAutoConfirmOpen(false);
                void commitThreadApprovalMode("full_auto_thread");
              }}
            >
              Enable full auto
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">
          You can tighten defaults anytime under{" "}
          <Link href="/app/config/workspace" className="text-accent underline">
            Configuration → Workspace
          </Link>
          .
        </p>
      </Modal>
      <WorkspaceLayout
        className="min-h-0"
        sidebar={memoSidebar}
        content={mainContent}
        aside={timelineSidebar}
        sidebarWidth="w-[260px]"
        asideWidth="w-72"
        sidebarClassName="min-h-0 border-r-0 bg-transparent p-0"
        contentClassName="min-h-0 bg-bg-app"
      />
    </>
  );
}
