import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import {
  ChevronLeft, Settings, Brain, Zap, Eye, User,
  Wrench, GitBranch, Paperclip, ChevronUp, ChevronDown, TerminalSquare,
} from "lucide-react";

// Design system components
import {
  Button,
  Toggle,
  LLMSelector,
  MCPServerConfig,
  EnvironmentConfig,
  WorktreeManager,
  ContextChips,
  createFileChip,
  useToast,
} from "@numezis/ui/components/design-system";
import type { ContextChip } from "@numezis/ui/components/design-system";

// Terminal component
import { Terminal } from "@numezis/ui/components/Terminal";

// Command Center components
import { TitleBar } from "@numezis/ui/components/CommandCenter/TitleBar";
import { ProjectSidebar } from "@numezis/ui/components/CommandCenter/ProjectSidebar";
import type { SidebarProject } from "@numezis/ui/components/CommandCenter/ProjectSidebar";
import { ConversationCenter } from "@numezis/ui/components/CommandCenter/ConversationCenter";
import { InputBar } from "@numezis/ui/components/CommandCenter/InputBar";
import { MessageQueue } from "@numezis/ui/components/CommandCenter/MessageQueue";
import { ProjectUtilitySidebar } from "@numezis/ui/components/CommandCenter/ProjectUtilitySidebar";
import type { PendingDiffItem, FileLink, GitSidebarData } from "@numezis/ui/components/CommandCenter/ProjectUtilitySidebar";
import { UncommittedChangesPanel } from "@numezis/ui/components/CommandCenter/UncommittedChangesPanel";
import type { FileDiffData } from "@numezis/ui/components/CommandCenter/UncommittedChangesPanel";
import { InlineDiffReview } from "@numezis/ui/components/CommandCenter/InlineDiffReview";
import type { InlineDiff } from "@numezis/ui/components/CommandCenter/InlineDiffReview";
import { SlashCommandMenu } from "@numezis/ui/components/CommandCenter/SlashCommandMenu";
import type { SlashCommandItem } from "@numezis/ui/components/CommandCenter/SlashCommandMenu";
import { MultimodalMenu } from "@numezis/ui/components/CommandCenter/MultimodalMenu";
import { SkillsManager } from "@numezis/ui/components/CommandCenter/SkillsManager";
import { AutomationsDashboard } from "@numezis/ui/components/CommandCenter/AutomationsDashboard";
import { AgentGraphSelector } from "@numezis/ui/components/CommandCenter/AgentGraphSelector";
import type { AgentGraph } from "@numezis/ui/components/CommandCenter/AgentGraphSelector";
import { ReplayConfirmDialog } from "@numezis/ui/components/CommandCenter/ReplayConfirmDialog";
import type { ReplayImpact } from "@numezis/ui/components/CommandCenter/ReplayConfirmDialog";

// Hooks
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { useWorkspace } from "../hooks/useWorkspace";
import { useThreads } from "../hooks/useThreads";
import { useConversation } from "../hooks/useConversation";
import { useDiffs } from "../hooks/useDiffs";
import { useModels } from "../hooks/useModels";
import { useGit } from "../hooks/useGit";
import { useProjects } from "../hooks/useProjects";
import { usePersonality } from "../hooks/usePersonality";
import { useSkills } from "../hooks/useSkills";

// Utils & types
import type { MCPServer, EnvVariable, Worktree, ConversationTab, Automation, QueuedMessage } from "../types";
import { SETTINGS_SECTIONS, formatRelativeTime, pathsEqual } from "../utils";

export default function App() {
  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS & BUSINESS LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  const toast = useToast();
  const settings = useSettings();
  const { backendUrlTrimmed, backendUrlValid, backendConnected, setBackendConnected } = settings;

  const auth = useAuth(backendUrlTrimmed, backendUrlValid);
  const backendReady = backendUrlValid && backendConnected;

  // Probe backend connectivity
  const backendProbeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!backendUrlValid) { setBackendConnected(false); backendProbeRef.current = null; return; }
    if (backendProbeRef.current === backendUrlTrimmed && backendConnected) return;
    (async () => {
      try {
        const res = await fetch(`${backendUrlTrimmed}/api/auth/me`, {
          headers: auth.auth?.accessToken ? { Authorization: `Bearer ${auth.auth.accessToken}` } : undefined,
        });
        setBackendConnected(res.status > 0);
        if (res.status > 0) backendProbeRef.current = backendUrlTrimmed;
      } catch { setBackendConnected(false); backendProbeRef.current = null; }
    })();
  }, [backendUrlTrimmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const workspace = useWorkspace(backendUrlTrimmed, auth.getAccessToken);
  const projectsHook = useProjects(workspace.workspace?.path, workspace.workspace?.name);

  const activeWorkspaceId = workspace.workspaceSummary?.id ?? projectsHook.activeProjectId ?? null;

  const models = useModels(backendUrlTrimmed, backendReady, auth.getAccessToken);
  const threads = useThreads(backendUrlTrimmed, backendReady, auth.getAccessToken, activeWorkspaceId);
  const diffs = useDiffs(workspace.workspace);
  const conversation = useConversation(
    backendUrlTrimmed, backendReady, auth.getAccessToken,
    threads.conversationId, threads.setConversationId,
    workspace.workspace, models.modelConfig, models.selectedGraph,
    models.selectedGraphName, threads.loadThreads, diffs.setDiffs,
    activeWorkspaceId
  );
  const git = useGit(workspace.workspace?.path ?? null, backendUrlTrimmed, auth.getAccessToken);
  const personality = usePersonality();
  const skillsHook = useSkills(backendUrlTrimmed, backendReady, auth.getAccessToken);

  // ═══════════════════════════════════════════════════════════════════════════
  // UI STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
  const [changesVisible, setChangesVisible] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [openTabs, setOpenTabs] = useState<ConversationTab[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [contextChips, setContextChips] = useState<ContextChip[]>([]);
  const [multimodalOpen, setMultimodalOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [replayImpact, setReplayImpact] = useState<ReplayImpact | null>(null);
  const [replayDialogOpen, setReplayDialogOpen] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        setSidebarVisible((p) => !p);
      }
      if (e.key === "b" && e.shiftKey) {
        e.preventDefault();
        setRightSidebarVisible((p) => !p);
      }
      if (e.key === "g" && e.shiftKey) {
        e.preventDefault();
        setChangesVisible((p) => {
          if (!p) void git.fetchAllDiffs();
          return !p;
        });
      }
      if (e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        // Create new thread in active project
        if (projectsHook.activeProjectId) {
          handleNewThreadInProject(projectsHook.activeProjectId);
        }
      }
      if (e.key === "w" && !e.shiftKey) {
        e.preventDefault();
        if (threads.conversationId) {
          handleTabClose(threads.conversationId);
        }
      }
      // Add new project: Cmd+O
      if (e.key === "o" && !e.shiftKey) {
        e.preventDefault();
        handleAddProject();
      }
      // Toggle terminal: Cmd+J
      if (e.key === "j" && !e.shiftKey) {
        e.preventDefault();
        setTerminalVisible((p) => !p);
      }
      // Switch tabs: Cmd+Shift+[ and Cmd+Shift+]
      if (e.key === "[" && e.shiftKey) {
        e.preventDefault();
        switchTab(-1);
      }
      if (e.key === "]" && e.shiftKey) {
        e.preventDefault();
        switchTab(1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [threads.conversationId, openTabs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  const dataLoadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!auth.auth?.accessToken || !backendReady) return;
    const key = `${backendUrlTrimmed}::${!!auth.auth.accessToken}`;
    if (dataLoadedKeyRef.current === key) return;
    dataLoadedKeyRef.current = key;
    void workspace.loadWorkspaceSummary();
    void threads.loadThreads();
    void models.loadGraphs();
    void models.loadModel();
    void models.loadTools();
    void skillsHook.loadSkills();
  }, [auth.auth?.accessToken, backendUrlTrimmed, backendReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const conversationLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!auth.auth?.accessToken || !threads.conversationId || conversation.streaming) return;
    const key = `${backendUrlTrimmed}::${threads.conversationId}`;
    if (conversationLoadedRef.current === key) return;
    conversationLoadedRef.current = key;
    void conversation.loadConversation(threads.conversationId);
  }, [auth.auth?.accessToken, threads.conversationId, backendUrlTrimmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${backendUrlTrimmed}::${workspace.workspace?.path}`;
    if (resetKeyRef.current === null) { resetKeyRef.current = key; return; }
    if (resetKeyRef.current === key) return;
    resetKeyRef.current = key;
    dataLoadedKeyRef.current = null;
    conversationLoadedRef.current = null;
    threads.resetThreads();
    conversation.resetConversation();
    diffs.resetDiffs();
  }, [backendUrlTrimmed, workspace.workspace?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh LLM config whenever the user opens Settings (config may have changed in the web UI)
  useEffect(() => {
    if (settings.activeView === "settings" && backendReady) {
      void models.loadModel();
    }
  }, [settings.activeView, backendReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED DATA
  // ═══════════════════════════════════════════════════════════════════════════

  const activeThread = threads.threads.find((t) => t.id === threads.conversationId) ?? null;
  const activeThreadTitle = activeThread?.title || (threads.conversationId ? "Untitled" : "New thread");

  // Build sidebar project data: single project derived from the ACTIVE workspace,
  // with threads for that workspace only. Workspace switching is done via the TitleBar dropdown.
  const sidebarProjects: SidebarProject[] = useMemo(() => {
    const name =
      workspace.workspace?.name ||
      workspace.workspace?.path?.split("/").pop() ||
      "Workspace";
    return [
      {
        id: workspace.workspace?.path ?? "default",
        name,
        threads: threads.threads.map((t) => ({
          id: t.id,
          title: t.title || "Untitled",
          updatedAt: t.updatedAt,
          liveStatus:
            t.status === "archived"
              ? ("idle" as const)
              : threads.conversationId === t.id && conversation.streaming
                ? ("running" as const)
                : ("idle" as const),
        })),
      },
    ];
  }, [threads.threads, threads.conversationId, conversation.streaming, workspace.workspace?.path, workspace.workspace?.name]);

  // Build pending diffs for right sidebar
  const pendingDiffItems: PendingDiffItem[] = useMemo(() => {
    return diffs.diffs.map((d) => ({
      editId: d.editId,
      filePath: d.filePath,
    }));
  }, [diffs.diffs]);

  // Build file links from conversation events (tool calls that touched files)
  const fileLinks: FileLink[] = useMemo(() => {
    const files = new Map<string, FileLink>();
    for (const event of conversation.conversationEvents) {
      if (event.toolName && event.toolArgs) {
        try {
          const args = JSON.parse(event.toolArgs);
          const path = args.filePath ?? args.path ?? args.file;
          if (typeof path === "string" && path) {
            const filename = path.split("/").pop() || path;
            files.set(path, {
              path,
              label: filename,
              type: event.toolName.includes("read") ? "read"
                : event.toolName.includes("write") || event.toolName.includes("edit") ? "write"
                  : "search",
            });
          }
        } catch {
          // ignore
        }
      }
    }
    return Array.from(files.values());
  }, [conversation.conversationEvents]);

  // Build inline diffs for conversation center
  const inlineDiffs: InlineDiff[] = useMemo(() => {
    return diffs.diffs.map((d) => ({
      editId: d.editId,
      filePath: d.filePath,
      hunks: d.hunks,
    }));
  }, [diffs.diffs]);

  // Build git sidebar data
  const gitSidebarData: GitSidebarData | null = useMemo(() => {
    if (!git.gitStatus && !git.gitLoading) return null;
    return {
      branch: git.gitStatus?.branch,
      ahead: git.gitStatus?.ahead,
      behind: git.gitStatus?.behind,
      totalChanges: git.totalChanges,
      modified: git.gitStatus?.modified,
      created: git.gitStatus?.created,
      deleted: git.gitStatus?.deleted,
      staged: git.gitStatus?.staged,
      unstaged: git.gitStatus?.unstaged,
      commitMessage: git.commitMessage,
      committing: git.committing,
      generatingMessage: git.generatingMessage,
      loading: git.gitLoading,
      error: git.gitError,
    };
  }, [git.gitStatus, git.totalChanges, git.commitMessage, git.committing, git.generatingMessage, git.gitLoading, git.gitError]);

  // Build file diffs for the uncommitted changes panel
  const uncommittedFileDiffs: FileDiffData[] = useMemo(() => {
    const files = git.gitStatus?.unstaged ?? [];
    return files.map((f) => ({
      path: f.path,
      status: f.status,
      diff: git.allDiffs.get(f.path) ?? null,
      loading: git.allDiffsLoading && !git.allDiffs.has(f.path),
    }));
  }, [git.gitStatus?.unstaged, git.allDiffs, git.allDiffsLoading]);

  // Auto-refresh diffs when panel is open and git status changes
  const unstagedPathsKey = useMemo(
    () => (git.gitStatus?.unstaged ?? []).map((f) => f.path).join(','),
    [git.gitStatus?.unstaged]
  );
  useEffect(() => {
    if (changesVisible && unstagedPathsKey) {
      void git.fetchAllDiffs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changesVisible, unstagedPathsKey]);

  // Build agent graph items for selector
  const agentGraphItems: AgentGraph[] = useMemo(() => {
    return models.graphs.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
    }));
  }, [models.graphs]);

  // Slash commands
  const slashCommands: SlashCommandItem[] = useMemo(() => [
    { id: "plan", label: "plan", description: "Toggle Plan Mode (read-only proposals)", icon: <Eye className="h-3.5 w-3.5" />, action: () => setPlanMode((p) => !p) },
    { id: "personality-pragmatic", label: "personality pragmatic", description: "Terse, execution-focused style", icon: <Zap className="h-3.5 w-3.5" />, category: "Personality", action: () => personality.setPersonality("pragmatic") },
    { id: "personality-empathetic", label: "personality empathetic", description: "Conversational, explanatory style", icon: <User className="h-3.5 w-3.5" />, category: "Personality", action: () => personality.setPersonality("empathetic") },
    { id: "skills", label: "skills", description: "Open Skills settings", icon: <Wrench className="h-3.5 w-3.5" />, action: () => { settings.setActiveView("settings"); settings.setActiveSettingsSection("skills"); } },
    { id: "worktree", label: "worktree", description: "Manage Git worktrees", icon: <GitBranch className="h-3.5 w-3.5" />, action: () => { settings.setActiveView("settings"); settings.setActiveSettingsSection("worktrees"); } },
  ], [personality, settings]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Switch workspace with a debounced toast notification.
   *  If the user clicks through multiple threads quickly, only the final
   *  workspace switch fires the toast and the intermediate ones are coalesced. */
  const switchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchWorkspaceTo = useCallback((path: string, name: string) => {
    if (pathsEqual(path, workspace.workspace?.path)) return;
    workspace.setWorkspace({ path, name });

    // Debounce the toast so rapid switching doesn't spam notifications
    if (switchDebounceRef.current) clearTimeout(switchDebounceRef.current);
    switchDebounceRef.current = setTimeout(() => {
      toast.info("Switched project", `Now working in ${name}`);
      switchDebounceRef.current = null;
    }, 400);
  }, [workspace.workspace?.path, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewThreadInProject(projectIdOrPath: string) {
    conversation.abortRef.current?.abort();
    conversation.resetConversation();
    diffs.resetDiffs();
    // Clear the current conversation so the next sendMessage creates a fresh session
    threads.setConversationId(null);

    // The sidebar might pass a path (rootPath), while the keyboard shortcut passes a UUID.
    const project = projectsHook.projects.find(
      (p) => p.id === projectIdOrPath || p.rootPath === projectIdOrPath
    );

    if (project) {
      projectsHook.setActiveProjectId(project.id);
      if (project.rootPath) {
        switchWorkspaceTo(project.rootPath, project.name);
      }
    }
  }

  /** Handle workspace selection from the TitleBar dropdown */
  function handleWorkspaceSelect(workspaceId: string) {
    conversation.abortRef.current?.abort();
    conversation.resetConversation();
    diffs.resetDiffs();
    threads.setConversationId(null);
    void workspace.switchWorkspaceById(workspaceId);
  }

  async function handleAddProject() {
    try {
      const result = await (window as any).numezis?.selectWorkspace?.();
      if (!result) return; // user cancelled the dialog
      const folderPath: string = result.path;
      const folderName: string = result.name || folderPath.split("/").pop() || "Project";
      projectsHook.addProject(folderName, folderPath);
      // Switch workspace to the newly added project
      switchWorkspaceTo(folderPath, folderName);
      // Also register on the backend and refresh the list
      try {
        const token = await auth.getAccessToken();
        if (token) {
          await fetch(`${backendUrlTrimmed}/api/workspaces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ rootPath: folderPath, name: folderName }),
          });
          await workspace.refreshAllWorkspaces();
        }
      } catch { /* ignore backend registration errors */ }
    } catch {
      // ignore — user cancelled or Electron API unavailable
    }
  }

  function handleThreadSelect(threadId: string) {
    if (threadId === threads.conversationId) return;
    conversation.abortRef.current?.abort();
    conversation.resetConversation();
    diffs.resetDiffs();
    threads.setConversationId(threadId);

    // Add to open tabs if not already there
    const thread = threads.threads.find((t) => t.id === threadId);
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === threadId)) return prev;
      return [...prev, { id: threadId, title: thread?.title || "Untitled" }];
    });
  }

  function handleTabClose(tabId: string) {
    setOpenTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (threads.conversationId === tabId) {
      const remaining = openTabs.filter((t) => t.id !== tabId);
      if (remaining.length > 0) {
        handleThreadSelect(remaining[remaining.length - 1].id);
      } else {
        threads.setConversationId(null);
        conversation.resetConversation();
        diffs.resetDiffs();
      }
    }
  }

  function switchTab(direction: number) {
    if (openTabs.length < 2 || !threads.conversationId) return;
    const idx = openTabs.findIndex((t) => t.id === threads.conversationId);
    const nextIdx = (idx + direction + openTabs.length) % openTabs.length;
    handleThreadSelect(openTabs[nextIdx].id);
  }

  function handleSendMessage() {
    const text = conversation.input.trim();
    if (!text) return;

    // If agent is streaming, queue the message instead of blocking
    if (conversation.streaming) {
      setMessageQueue((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
      ]);
      conversation.setInput("");
      return;
    }

    void conversation.sendMessage({
      personalityPrefix: personality.getSystemPromptPrefix(),
      planMode,
    });
  }

  /** Send a specific text directly (used by queue dequeue). */
  function sendTextDirectly(text: string) {
    void conversation.sendMessage({
      personalityPrefix: personality.getSystemPromptPrefix(),
      planMode,
      text,
    });
  }

  // ── Message Queue handlers ────────────────────────────────────────────────

  function handleQueueEdit(id: string, newText: string) {
    setMessageQueue((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: newText } : m))
    );
  }

  function handleQueueMoveUp(id: string) {
    setMessageQueue((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function handleQueueDelete(id: string) {
    setMessageQueue((prev) => prev.filter((m) => m.id !== id));
  }

  /** Dequeue and send the first queued message. */
  function dequeueAndSend() {
    const next = messageQueue[0];
    if (!next) return;
    setMessageQueue((prev) => prev.slice(1));
    sendTextDirectly(next.text);
  }

  /** Force-send: stop current stream, then send the next queued message.
   *  Uses a short timeout to let React flush the streaming=false state update. */
  function handleQueueForceSend() {
    conversation.stopStreaming();
    setTimeout(() => dequeueAndSend(), 120);
  }

  // Auto-dequeue: when streaming finishes and there are queued messages, send the next one
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = conversation.streaming;

    // Only trigger on streaming → idle transition
    if (wasStreaming && !conversation.streaming && messageQueue.length > 0) {
      // Small delay lets React fully settle before we start a new send
      setTimeout(() => dequeueAndSend(), 50);
    }
  }, [conversation.streaming, messageQueue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInputKeyDown(e: React.KeyboardEvent) {
    // Detect slash command
    if (conversation.input === "" && e.key === "/") {
      setSlashMenuOpen(true);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // Close slash menu when input changes away from /
  useEffect(() => {
    if (!conversation.input.startsWith("/")) {
      setSlashMenuOpen(false);
    }
  }, [conversation.input]);

  function handleRequestIteration(editId: string, comment: string) {
    const diff = diffs.diffs.find((d) => d.editId === editId);
    const prefix = diff ? `Regarding changes to ${diff.filePath}: ` : "";
    conversation.setInput(`${prefix}${comment}`);
  }

  // ── Replay (edit & resend) flow ─────────────────────────────────────────────
  function handleResendEdit() {
    if (conversation.editingMessageIndex === null) return;
    const draft = conversation.editingMessageDraft.trim();
    if (!draft) return;

    // Find the original content of the message being edited
    const originalEvent = conversation.conversationEvents.find(
      (e) => e.messageIndex === conversation.editingMessageIndex
    );
    const originalContent = originalEvent?.content ?? "";

    // Compute what will be lost
    const impact = conversation.computeReplayImpact(
      conversation.editingMessageIndex,
      originalContent,
      draft
    );

    // If there's nothing after this message (it's the last user message), just replay directly
    if (impact.messagesRemoved === 0 && impact.toolCallsRemoved === 0 && impact.fileChanges.length === 0) {
      void executeReplay();
      return;
    }

    // Show confirmation dialog
    setReplayImpact(impact);
    setReplayDialogOpen(true);
  }

  async function executeReplay() {
    if (conversation.editingMessageIndex === null) return;
    const draft = conversation.editingMessageDraft.trim();
    if (!draft) return;

    setReplayLoading(true);
    setReplayDialogOpen(false);

    await conversation.replayFromMessage(
      conversation.editingMessageIndex,
      draft,
      { personalityPrefix: personality.getSystemPromptPrefix(), planMode }
    );

    setReplayImpact(null);
    setReplayLoading(false);

    // The replayFromMessage sets input — now trigger send
    // We need a small delay for state to propagate, then auto-send
    setTimeout(() => {
      conversation.sendMessage({ personalityPrefix: personality.getSystemPromptPrefix(), planMode });
    }, 50);
  }

  function cancelReplay() {
    setReplayDialogOpen(false);
    setReplayImpact(null);
  }

  // Auto-add new conversation to tabs
  useEffect(() => {
    if (!threads.conversationId) return;
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === threads.conversationId)) {
        // Update title
        const thread = threads.threads.find((t) => t.id === threads.conversationId);
        if (thread) {
          return prev.map((t) => t.id === threads.conversationId ? { ...t, title: thread.title || "Untitled" } : t);
        }
        return prev;
      }
      const thread = threads.threads.find((t) => t.id === threads.conversationId);
      return [...prev, { id: threads.conversationId!, title: thread?.title || "Untitled" }];
    });
  }, [threads.conversationId, threads.threads]);

  // No project auto-assignment: threads are now scoped purely by workspace.

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (settings.activeView === "settings") {
    return (
      <div className="flex h-screen flex-col text-text-primary">
        <header className="flex h-10 items-center glass-titlebar px-4 pl-[76px] app-region-drag">
          <span className="text-xs font-medium text-text-secondary">Settings</span>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <aside className="flex w-60 flex-col glass-sidebar px-2 py-3">
            <button type="button" onClick={() => settings.setActiveView("app")} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to app
            </button>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Settings</div>
            <div className="mt-2 flex flex-col gap-1">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => settings.setActiveSettingsSection(section.id)}
                  className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs font-medium transition ${settings.activeSettingsSection === section.id
                    ? "bg-state-selected text-text-primary"
                    : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                    }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto px-6 py-4 scrollbar-elegant">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {/* Configuration */}
              {(settings.activeSettingsSection === "configuration" || settings.activeSettingsSection === "general") && (
                <>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Backend</h2>
                    <div className="glass-card divide-y divide-border-subtle rounded-md">
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div><div className="text-sm font-medium text-text-primary">Backend URL</div><div className="text-xs text-text-muted">Connect to your Numezis backend.</div></div>
                        <input value={settings.backendUrl} onChange={(e) => settings.setBackendUrl(e.target.value)} className="w-56 rounded-md border border-border-subtle bg-bg-app px-2 py-1 text-xs text-text-primary" placeholder="https://app.numezis.com" />
                      </div>
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div className="text-sm font-medium text-text-primary">Connection status</div>
                        <span className={`flex items-center gap-1.5 text-xs ${backendReady ? "text-status-success-text" : "text-status-error-text"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${backendReady ? "bg-status-success" : "bg-status-error"}`} />
                          {backendReady ? "Connected" : "Disconnected"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div><div className="text-sm font-medium text-text-primary">Account</div><div className="text-xs text-text-muted">{auth.auth?.user?.email || "Sign in to access threads."}</div></div>
                        <div className="flex items-center gap-2">
                          {auth.auth?.accessToken ? (
                            <Button size="xs" variant="secondary" onClick={auth.signOut}>Sign out</Button>
                          ) : (
                            <>
                              <Button size="xs" variant="secondary" onClick={auth.startWebLogin} disabled={!backendUrlValid || auth.loginPending}>{auth.loginPending ? "Signing in..." : "Sign in"}</Button>
                              <Button size="xs" variant="ghost" onClick={auth.startWebRegister} disabled={!backendUrlValid || auth.loginPending}>Create account</Button>
                            </>
                          )}
                        </div>
                      </div>
                      {auth.loginError && <div className="px-3 py-2 text-xs text-status-error-text">{auth.loginError}</div>}
                    </div>
                  </section>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Models</h2>
                    <LLMSelector providers={models.providers} selectedProvider={models.selectedProvider} selectedModel={models.selectedModel} onProviderChange={models.changeProvider} onModelChange={models.changeModel} />
                  </section>
                </>
              )}
              {/* General */}
              {settings.activeSettingsSection === "general" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">General</h2>
                  <div className="glass-card divide-y divide-border-subtle rounded-md">
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div><div className="text-sm font-medium text-text-primary">Prevent sleep while running</div><div className="text-xs text-text-muted">Keep your computer awake while the agent runs.</div></div>
                      <Toggle size="sm" checked={settings.settingsToggles.preventSleep} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, preventSleep: c }))} />
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div><div className="text-sm font-medium text-text-primary">Require Cmd+Enter to send</div><div className="text-xs text-text-muted">Multiline prompts require Cmd+Enter to send.</div></div>
                      <Toggle size="sm" checked={settings.settingsToggles.requireCmdEnter} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, requireCmdEnter: c }))} />
                    </div>
                  </div>
                </section>
              )}
              {/* Personalization */}
              {settings.activeSettingsSection === "personalization" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Appearance & Personality</h2>
                  <div className="glass-card divide-y divide-border-subtle rounded-md">
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div><div className="text-sm font-medium text-text-primary">Compact density</div><div className="text-xs text-text-muted">Reduce padding across the interface.</div></div>
                      <Toggle size="sm" checked={settings.settingsToggles.compactDensity} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, compactDensity: c }))} />
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div><div className="text-sm font-medium text-text-primary">Personality mode</div><div className="text-xs text-text-muted">Controls the agent's communication style.</div></div>
                      <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-app p-0.5">
                        <button type="button" onClick={() => personality.setPersonality("pragmatic")} className={`px-2 py-1 rounded text-xs transition ${personality.personality === "pragmatic" ? "bg-state-selected text-text-primary" : "text-text-muted hover:text-text-primary"}`}>Pragmatic</button>
                        <button type="button" onClick={() => personality.setPersonality("empathetic")} className={`px-2 py-1 rounded text-xs transition ${personality.personality === "empathetic" ? "bg-state-selected text-text-primary" : "text-text-muted hover:text-text-primary"}`}>Empathetic</button>
                      </div>
                    </div>
                  </div>
                </section>
              )}
              {/* MCP */}
              {settings.activeSettingsSection === "mcp" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">MCP Servers</h2>
                  <MCPServerConfig
                    servers={mcpServers}
                    onAdd={(s) => setMcpServers((p) => [...p, { ...s, id: crypto.randomUUID(), enabled: true, status: "disconnected" }])}
                    onRemove={(id) => setMcpServers((p) => p.filter((s) => s.id !== id))}
                    onToggle={(id, enabled) => setMcpServers((p) => p.map((s) => (s.id === id ? { ...s, enabled } : s)))}
                  />
                </section>
              )}
              {/* Skills */}
              {settings.activeSettingsSection === "skills" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Skills</h2>
                  <p className="text-xs text-text-muted">Skills extend the agent's capabilities by connecting to external tools and platforms.</p>
                  <SkillsManager
                    skills={skillsHook.skills}
                    onAdd={skillsHook.addSkill}
                    onRemove={skillsHook.removeSkill}
                    onToggle={skillsHook.toggleSkill}
                  />
                </section>
              )}
              {/* Automations */}
              {settings.activeSettingsSection === "automations" && (
                <section className="space-y-3">
                  <AutomationsDashboard
                    automations={automations}
                    onAdd={(name, description, schedule) => setAutomations((p) => [...p, { id: crypto.randomUUID(), name, description, schedule, status: "active" }])}
                    onRemove={(id) => setAutomations((p) => p.filter((a) => a.id !== id))}
                    onToggle={(id) => setAutomations((p) => p.map((a) => a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a))}
                  />
                </section>
              )}
              {/* Agent Graphs */}
              {settings.activeSettingsSection === "graphs" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Agent Graphs</h2>
                  <p className="text-xs text-text-muted">
                    Agent graphs define different workflows for the AI. Select a graph when starting a conversation to guide the agent's behavior.
                  </p>
                  {models.graphsLoading && (
                    <div className="glass-card rounded-md px-3 py-4 text-xs text-text-muted text-center animate-pulse">
                      Loading graphs...
                    </div>
                  )}
                  {models.graphsError && (
                    <div className="border border-status-error-bg bg-status-error-bg/10 rounded-md px-3 py-2 text-xs text-status-error-text">
                      {models.graphsError}
                    </div>
                  )}
                  {!models.graphsLoading && models.graphs.length === 0 && !models.graphsError && (
                    <div className="glass-card rounded-md px-3 py-4 text-xs text-text-muted text-center">
                      No agent graphs available. Configure them in the web portal.
                    </div>
                  )}
                  <div className="space-y-2">
                    {models.graphs.map((graph) => (
                      <div
                        key={graph.id}
                        className={`rounded-md px-3 py-2.5 transition-colors cursor-pointer ${models.selectedGraph === graph.id
                          ? "glass-selected"
                          : "glass-card"
                          }`}
                        onClick={() => models.setSelectedGraph(graph.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-text-muted" />
                            <span className="text-sm font-medium text-text-primary">{graph.name}</span>
                          </div>
                          {models.selectedGraph === graph.id && (
                            <span className="text-[10px] text-status-success-text font-medium">Active</span>
                          )}
                        </div>
                        {graph.description && (
                          <p className="mt-1 text-xs text-text-muted pl-6">{graph.description}</p>
                        )}
                        {graph.updatedAt && (
                          <p className="mt-0.5 text-[10px] text-text-muted pl-6">Updated {formatRelativeTime(graph.updatedAt)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => models.loadGraphs()} disabled={models.graphsLoading}>
                    Reload Graphs
                  </Button>
                </section>
              )}
              {/* Environments */}
              {settings.activeSettingsSection === "environments" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Environment Variables</h2>
                  <EnvironmentConfig
                    variables={envVariables}
                    onAdd={(v) => setEnvVariables((p) => [...p, v])}
                    onRemove={(key) => setEnvVariables((p) => p.filter((v) => v.key !== key))}
                    onEdit={(key, value) => setEnvVariables((p) => p.map((v) => (v.key === key ? { ...v, value } : v)))}
                  />
                </section>
              )}
              {/* Worktrees */}
              {settings.activeSettingsSection === "worktrees" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Worktrees</h2>
                  <p className="text-xs text-text-muted">Each agent can operate in an isolated worktree to prevent merge conflicts.</p>
                  <WorktreeManager
                    worktrees={worktrees}
                    activeWorktree={workspace.workspace?.path}
                    onAdd={(path, branch) => setWorktrees((p) => [...p, { path, branch, isMain: false }])}
                    onRemove={(path) => setWorktrees((p) => p.filter((w) => w.path !== path))}
                    onSwitch={(path) => workspace.setWorkspace({ path, name: path.split("/").pop() || path })}
                  />
                </section>
              )}
              {/* Archived */}
              {settings.activeSettingsSection === "archived" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Archived Threads</h2>
                  <div className="glass-card px-3 py-4 text-xs text-text-muted text-center rounded-md">
                    Archived threads can be viewed and restored from the web portal.
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMAND CENTER VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen flex-col text-text-primary">
      {/* ── Title Bar ── */}
      <TitleBar
        workspaceName={workspace.workspace?.name || workspace.workspace?.path?.split("/").pop() || "Numezis Desktop"}
        workspaceSelectorLabel={workspace.workspace?.name || workspace.workspace?.path?.split("/").pop() || "Select workspace"}
        onWorkspaceSelectorClick={() => { void workspace.selectWorkspace(); }}
        workspaceItems={workspace.allWorkspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceSelect={handleWorkspaceSelect}
        onAddWorkspace={handleAddProject}
        showTrafficLights={false}
        onOpen={() => {
          try { (window as any).numezis?.openInVSCode?.(); } catch { /* ignore */ }
        }}
        onCommit={() => {
          // Focus the right sidebar git section to write commit message
          setRightSidebarVisible(true);
        }}
        onPush={() => void git.push()}
        onCreatePR={() => {
          // Push first, then create PR. Use commit message as PR title, or a default.
          const title = git.commitMessage.trim() || `PR from ${git.gitStatus?.branch ?? 'branch'}`;
          void git.push().then(() =>
            git.createPR(title).then((result) => {
              if (result?.url) {
                try { (window as any).numezis?.openExternal?.(result.url); } catch { /* ignore */ }
              }
            })
          );
        }}
        committing={git.committing}
        pushing={git.pushing}
        creatingPR={git.creatingPR}
        threadTitle={activeThreadTitle}
        onToggleTerminal={() => setTerminalVisible((p) => !p)}
        onToggleChanges={() => {
          setChangesVisible((p) => {
            if (!p) void git.fetchAllDiffs();
            return !p;
          });
        }}
        changesVisible={changesVisible}
        gitDiffStats={git.gitStatus ? {
          additions: git.gitStatus.created.length + git.gitStatus.modified.length,
          deletions: git.gitStatus.deleted.length,
        } : undefined}
      />

      {/* ── Three-Pane Body ── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left Sidebar: Project Navigation */}
        {sidebarVisible && (
          <ProjectSidebar
            projects={sidebarProjects}
            activeThreadId={threads.conversationId}
            activeProjectId={workspace.workspace?.path ?? null}
            onThreadSelect={handleThreadSelect}
            onNewThreadInProject={handleNewThreadInProject}
            onAddProject={handleAddProject}
            onSettings={() => settings.setActiveView("settings")}
            onRenameThread={(threadId, newTitle) => {
              threads.startEditThread({ id: threadId, title: newTitle });
              threads.setEditingThreadTitle(newTitle);
              void threads.saveEditedThreadTitle();
            }}
            onArchiveThread={(threadId) => void threads.archiveThread(threadId)}
            onDeleteThread={(threadId) => void threads.deleteThread(threadId)}
          />
        )}

        {/* Center: Conversation Workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Conversation Messages */}
          <ConversationCenter
            renderItems={conversation.renderItems}
            streaming={conversation.streaming}
            streamHasEvents={conversation.streamHasEvents}
            streamingText={conversation.streamingText}
            sendError={conversation.sendError}
            conversationLoading={conversation.conversationLoading}
            conversationId={threads.conversationId}
            threadTitle={activeThreadTitle}
            threadUpdatedAt={activeThread?.updatedAt ? formatRelativeTime(activeThread.updatedAt) : undefined}
            editingMessageIndex={conversation.editingMessageIndex}
            editingMessageDraft={conversation.editingMessageDraft}
            editingMessageSaving={conversation.editingMessageSaving}
            editingMessageError={conversation.editingMessageError}
            onStartEdit={conversation.startEditMessage}
            onResendEdit={handleResendEdit}
            onCancelEdit={conversation.cancelEditMessage}
            onEditDraftChange={conversation.setEditingMessageDraft}
            diffReview={
              inlineDiffs.length > 0 ? (
                <InlineDiffReview
                  diffs={inlineDiffs}
                  onAccept={(editId) => diffs.applyAllDiff(editId)}
                  onReject={(editId) => diffs.rejectAllDiff(editId)}
                  onOpenInIDE={(filePath) => {
                    try { (window as any).numezis?.openInVSCode?.(filePath); } catch { /* ignore */ }
                  }}
                  onRequestIteration={handleRequestIteration}
                />
              ) : undefined
            }
          />

          {/* Input Bar */}
          <div className="relative">
            {/* Slash command menu */}
            <SlashCommandMenu
              open={slashMenuOpen}
              onClose={() => setSlashMenuOpen(false)}
              commands={slashCommands}
              filter={conversation.input}
            />
            {/* Multimodal menu */}
            <MultimodalMenu
              open={multimodalOpen}
              onClose={() => setMultimodalOpen(false)}
              onIncludeFile={async () => {
                try {
                  const paths = await (window as any).numezis?.pickFile?.();
                  if (Array.isArray(paths)) {
                    for (const p of paths) {
                      const filename = p.split("/").pop() || p;
                      setContextChips((prev) => [...prev, createFileChip(filename, p)]);
                    }
                  }
                } catch { /* ignore */ }
              }}
              onTakeScreenshot={async () => {
                try {
                  await (window as any).numezis?.captureScreenshot?.();
                } catch { /* ignore */ }
              }}
            />
            {/* Queued messages (visible when agent is busy) */}
            <MessageQueue
              messages={messageQueue}
              onEdit={handleQueueEdit}
              onMoveUp={handleQueueMoveUp}
              onDelete={handleQueueDelete}
              onForceSend={handleQueueForceSend}
              streaming={conversation.streaming}
            />
            <InputBar
              value={conversation.input}
              onChange={conversation.setInput}
              onSend={handleSendMessage}
              onStop={conversation.stopStreaming}
              sending={conversation.streaming}
              disabled={!backendReady || !auth.auth?.accessToken}
              placeholder={
                conversation.streaming
                  ? "Add a follow-up (queued until agent finishes)..."
                  : planMode
                    ? "Describe what you want to plan..."
                    : "Describe what you want to build..."
              }
              onKeyDown={handleInputKeyDown}
              contextChips={contextChips}
              onDismissChip={(id) => setContextChips((p) => p.filter((c) => c.id !== id))}
              onPaperclipClick={() => setMultimodalOpen((p) => !p)}
              planMode={planMode}
              connected={
                !backendConnected
                  ? false
                  : models.llmHealthChecking
                    ? 'checking'
                    : models.llmHealthy === true
              }
              connectionLabel={
                !backendConnected
                  ? 'Backend disconnected'
                  : models.llmHealthChecking
                    ? `Testing ${models.selectedProvider ?? 'LLM'}…`
                    : models.llmHealthy
                      ? `${models.selectedProvider ?? 'LLM'} connected`
                      : `${models.selectedProvider ?? 'LLM'} unreachable`
              }
              tokenUsage={conversation.tokenUsage}
              graphSelector={
                <AgentGraphSelector
                  graphs={agentGraphItems}
                  selectedGraphId={models.selectedGraph}
                  onGraphSelect={models.setSelectedGraph}
                  loading={models.graphsLoading}
                />
              }
              modelSelector={
                <LLMSelector
                  providers={models.providers}
                  selectedProvider={models.selectedProvider}
                  selectedModel={models.selectedModel}
                  onProviderChange={models.changeProvider}
                  onModelChange={models.changeModel}
                  compact
                />
              }
            />
          </div>

          {/* ── Collapsible Terminal Panel (below input bar) ── */}
          {terminalVisible && (
            <div className="border-t border-glass-border flex flex-col" style={{ height: 220 }}>
              <div className="flex items-center justify-between px-3 py-1 glass-titlebar flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <TerminalSquare className="h-3 w-3 text-text-muted" />
                  <span className="text-[11px] font-medium text-text-secondary">Terminal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTerminalVisible(false)}
                  className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                  title="Close terminal (⌘J)"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <Terminal workspacePath={workspace.workspace?.path} />
              </div>
            </div>
          )}
        </div>

        {/* Middle Panel: Uncommitted Changes Diffs */}
        {changesVisible && (
          <div className="w-[480px] min-w-[360px] max-w-[640px] flex-shrink-0">
            <UncommittedChangesPanel
              fileDiffs={uncommittedFileDiffs}
              loading={git.allDiffsLoading}
              onClose={() => setChangesVisible(false)}
              onOpenInIDE={(p) => {
                try { (window as any).numezis?.openInVSCode?.(p); } catch { /* ignore */ }
              }}
              onStageFile={(p) => { void git.stageFile(p).then(() => git.fetchAllDiffs()); }}
              onRevertFile={(p) => { void git.revertFile(p).then(() => git.fetchAllDiffs()); }}
              onRevertAll={() => { void git.revertAll().then(() => git.fetchAllDiffs()); }}
              onStageAll={() => { void git.stageAll().then(() => git.fetchAllDiffs()); }}
            />
          </div>
        )}

        {/* Right Sidebar: Source Control */}
        {rightSidebarVisible && (
          <ProjectUtilitySidebar
            fileLinks={fileLinks}
            pendingDiffs={pendingDiffItems}
            onOpenDiff={(editId) => {
              // Scroll to diff in conversation
            }}
            onAcceptDiff={(editId) => diffs.applyAllDiff(editId)}
            onRejectDiff={(editId) => diffs.rejectAllDiff(editId)}
            onOpenInIDE={(filePath) => {
              try { (window as any).numezis?.openInVSCode?.(filePath); } catch { /* ignore */ }
            }}
            gitData={gitSidebarData}
            onGitCommit={(msg) => git.commit(msg)}
            onGitCommitStaged={(msg) => git.commitStaged(msg)}
            onGitRefresh={() => git.refreshStatus()}
            onGitGenerateMessage={() => git.generateCommitMessage()}
            onCommitMessageChange={(msg) => git.setCommitMessage(msg)}
            onGitStageFile={(p) => git.stageFile(p)}
            onGitStageAll={() => git.stageAll()}
            onGitUnstageFile={(p) => git.unstageFile(p)}
            onGitUnstageAll={() => git.unstageAll()}
            onGitRevertFile={(p) => git.revertFile(p)}
            onGitRevertAll={() => git.revertAll()}
            onViewFileDiff={(file, staged) => {
              // When clicking a file in the sidebar, open it in the changes panel
              setChangesVisible(true);
              void git.fetchAllDiffs();
            }}
            selectedDiffPath={git.selectedDiffPath}
          />
        )}
      </div>

      {/* Replay Confirmation Dialog */}
      <ReplayConfirmDialog
        open={replayDialogOpen}
        impact={replayImpact}
        onConfirm={executeReplay}
        onCancel={cancelReplay}
        loading={replayLoading}
      />
    </div>
  );
}
