import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useAgentSession } from "@kletron/ui/hooks/useAgentSession";
import { useSlashSkills } from "@kletron/ui/hooks/useSlashSkills";
import {
  Brain, Eye,
  Wrench, GitBranch, Paperclip, ChevronUp, ChevronDown, TerminalSquare,
  Settings2,
  GraduationCap,
  X,
  AlertTriangle,
} from "lucide-react";

// Design system components
import {
  Button,
  Toggle,
  LLMSelector,
  Selector,
  MCPServerConfig,
  EnvironmentConfig,
  WorktreeManager,
  ContextChips,
  createFileChip,
  useToast,
} from "@kletron/ui/components/design-system";
import type { ContextChip } from "@kletron/ui/components/design-system";

// Terminal component
import { Terminal } from "@kletron/ui/components/Terminal";

// Command Center components
import { TitleBar } from "@kletron/ui/components/CommandCenter/TitleBar";
import { ProjectSidebar } from "@kletron/ui/components/CommandCenter/ProjectSidebar";
import type { SidebarProject } from "@kletron/ui/components/CommandCenter/ProjectSidebar";
import { ThreadSearchPalette } from "@kletron/ui/components/CommandCenter/ThreadSearchPalette";
import { ThreadSearchHeaderTrigger } from "@kletron/ui/components/CommandCenter/ThreadSearchHeaderTrigger";
import { MessageList } from "@kletron/ui/components/Agent/MessageList";
import { AgentStatusShimmerLabel } from "@kletron/ui/components/Agent/AgentStatusShimmerLabel";
import { ConversationThreadSkeleton } from "@kletron/ui/components/Agent/ConversationThreadSkeleton";
import { PendingSessionEditsStrip } from "@kletron/ui/components/design-system";
import { MessageActions } from "@kletron/ui/components/Agent/MessageActions";
import { useMessageEdit } from "@kletron/ui/hooks/useMessageEdit";
import { InputBar } from "@kletron/ui/components/CommandCenter/InputBar";
import { MessageQueue } from "@kletron/ui/components/CommandCenter/MessageQueue";
import { ProjectUtilitySidebar } from "@kletron/ui/components/CommandCenter/ProjectUtilitySidebar";
import type { PendingDiffItem, FileLink, GitSidebarData } from "@kletron/ui/components/CommandCenter/ProjectUtilitySidebar";
import { UncommittedChangesPanel } from "@kletron/ui/components/CommandCenter/UncommittedChangesPanel";
import type { FileDiffData } from "@kletron/ui/components/CommandCenter/UncommittedChangesPanel";
import { ResizeHandle } from "@kletron/ui/components/CommandCenter/ResizeHandle";
import { useResizablePanel } from "@kletron/ui/hooks/useResizablePanel";
import { InlineDiffReview } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import type { InlineDiff } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import { SlashCommandMenu } from "@kletron/ui/components/CommandCenter/SlashCommandMenu";
import type { SlashCommandItem } from "@kletron/ui/components/CommandCenter/SlashCommandMenu";
import { MultimodalMenu } from "@kletron/ui/components/CommandCenter/MultimodalMenu";
import { SkillsManager } from "@kletron/ui/components/CommandCenter/SkillsManager";
import { AutomationsDashboard } from "@kletron/ui/components/CommandCenter/AutomationsDashboard";
import { ThreadApprovalModeSelector } from "@kletron/ui/components/Agent/ThreadApprovalModeSelector";
import { ReplayConfirmDialog } from "@kletron/ui/components/CommandCenter/ReplayConfirmDialog";
import type { ReplayImpact } from "@kletron/ui/components/CommandCenter/ReplayConfirmDialog";

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

import { useSkills } from "../hooks/useSkills";
import { useCategories } from "../hooks/useCategories";
import { WORK_MODES, normalizeToWorkModeId, type WorkModeId } from "@kletron/shared/workMode";
import { sessionStatusToSidebarLiveStatus } from "@kletron/shared/chatTypes";
import {
  CAPABILITY_DROPPED_BANNER_TAIL,
  CAPABILITY_DROPPED_SLIM_CTA_LABEL,
  capabilityDroppedSlimBarTitle,
  formatDroppedToolsListPhrase,
} from "@kletron/shared/capabilityDroppedToolsUx";
import { DesktopWorkspaceProvider } from "../providers/DesktopWorkspaceProvider";

// Utils & types
import type {
  MCPServer,
  EnvVariable,
  Worktree,
  ConversationTab,
  QueuedMessage,
  LlmConfig,
  AgentGraphSummary,
} from "../types";
import { useAutomations } from "../hooks/useAutomations";
import { useDesktopApiFetch } from "../hooks/useDesktopApiFetch";
import { AutomationBuilderModal } from "@kletron/ui/components/AutomationBuilderModal";
import { AgentGraphsPanel } from "./AgentGraphsPanel";
import { DesktopPrimaryNav } from "./DesktopPrimaryNav";
import { HistoryPanel } from "./HistoryPanel";
import { CodeRepoConnectorStrip } from "@kletron/ui/components/CommandCenter/CodeRepoConnectorStrip";
import { AgentSessionChrome } from "@kletron/ui/components/CommandCenter/AgentSessionChrome";
import { PORTAL_LINK_GROUPS } from "../portalLinks";
import { SETTINGS_SECTIONS, formatRelativeTime, pathsEqual } from "../utils";
import { getComposerConnectionState } from "../composerConnection";
import { SettingsCard, DeviceOnlyPortalBanner } from "../components/SettingsCard";
import { usePortalConfigSnapshot } from "../hooks/usePortalConfigSnapshot";

export default function App() {
  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS & BUSINESS LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  const toast = useToast();
  const settings = useSettings();
  const { backendUrlTrimmed, backendUrlValid, backendConnected, setBackendConnected } = settings;

  const auth = useAuth(backendUrlTrimmed, backendUrlValid);
  const backendReady = backendUrlValid && backendConnected;

  const openPortalPath = useCallback((path: string) => {
    try {
      const base = backendUrlTrimmed.replace(/\/$/, "");
      void (window as { kletron?: { openExternal?: (u: string) => Promise<boolean> } }).kletron?.openExternal?.(`${base}${path}`);
    } catch {
      // ignore
    }
  }, [backendUrlTrimmed]);

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
  }, [backendUrlTrimmed, auth.auth?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const workspace = useWorkspace(backendUrlTrimmed, auth.getAccessToken);
  const projectsHook = useProjects(workspace.workspace?.path, workspace.workspace?.name);

  /** Backend workspace id for API headers. Prefer summary; fall back to matching `allWorkspaces` by root path so automations/threads load before summary catches up (never use projectsHook ids — local-only). */
  const activeWorkspaceId = useMemo(() => {
    const fromSummary = workspace.workspaceSummary?.id?.trim();
    if (fromSummary) return fromSummary;
    const rootPath = workspace.workspace?.path;
    if (!rootPath || workspace.allWorkspaces.length === 0) return null;
    const hit = workspace.allWorkspaces.find((w) => pathsEqual(w.rootPath, rootPath));
    return hit?.id ?? null;
  }, [workspace.workspaceSummary?.id, workspace.workspace?.path, workspace.allWorkspaces]);

  // Work categories system (server + localStorage, same as web agent work mode)
  const categoriesHook = useCategories({
    backendUrlTrimmed,
    backendReady,
    getAccessToken: auth.getAccessToken,
    activeWorkspaceId,
  });
  const desktopWorkMode = normalizeToWorkModeId(categoriesHook.activeCategory);
  const isCodeMode = desktopWorkMode === "code";

  const getAgentRequestHeaders = useCallback(async () => {
    const token = await auth.getAccessToken();
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    if (activeWorkspaceId) h["x-workspace-id"] = activeWorkspaceId;
    return h;
  }, [auth.getAccessToken, activeWorkspaceId]);

  const agentSession = useAgentSession({
    apiOrigin: backendUrlTrimmed,
    getRequestHeaders: getAgentRequestHeaders,
  });

  const { skills: slashSkillRows } = useSlashSkills({
    apiOrigin: backendUrlTrimmed,
    getRequestHeaders: getAgentRequestHeaders,
    enabled: backendReady,
    workspaceId: activeWorkspaceId,
  });

  const composerConnection = useMemo(
    () =>
      getComposerConnectionState({
        backendUrlValid,
        backendConnected,
        hasAccessToken: !!auth.auth?.accessToken,
        activeWorkspaceId,
        llmStatus: agentSession.llmSelectorLoading ? "loading" : agentSession.llmStatus,
        llmProviderLabel: agentSession.llmProvider.trim() || "LLM",
      }),
    [
      backendUrlValid,
      backendConnected,
      auth.auth?.accessToken,
      activeWorkspaceId,
      agentSession.llmSelectorLoading,
      agentSession.llmStatus,
      agentSession.llmProvider,
    ],
  );

  const models = useModels(backendUrlTrimmed, backendReady, auth.getAccessToken, activeWorkspaceId);
  const apiFetch = useDesktopApiFetch(backendUrlTrimmed, auth.getAccessToken, activeWorkspaceId);
  const automationsHook = useAutomations(backendUrlTrimmed, backendReady, auth.getAccessToken, activeWorkspaceId);
  const threads = useThreads(
    backendUrlTrimmed,
    backendReady,
    auth.getAccessToken,
    activeWorkspaceId,
    desktopWorkMode,
  );
  const portalConfigSnapshot = usePortalConfigSnapshot(
    backendUrlTrimmed,
    settings.activeView === "settings" &&
      settings.activeSettingsSection === "configuration" &&
      backendReady &&
      !!activeWorkspaceId,
    auth.getAccessToken,
    activeWorkspaceId,
  );
  const diffs = useDiffs(workspace.workspace);

  const modelConfigForStream = useMemo((): LlmConfig | null => {
    if (!agentSession.llmConfigData) return null;
    return {
      ...agentSession.llmConfigData,
      provider: agentSession.llmProvider,
    } as LlmConfig;
  }, [agentSession.llmConfigData, agentSession.llmProvider]);

  const selectedGraphTitle = useMemo(() => {
    const id = agentSession.selectedGraphId;
    const fromApi = agentSession.agentGraphs.find((g) => String(g._id) === id);
    if (fromApi) return fromApi.name;
    return agentSession.graphSelectOptions.find((o) => o.id === id)?.label;
  }, [agentSession.selectedGraphId, agentSession.agentGraphs, agentSession.graphSelectOptions]);

  const conversation = useConversation(
    backendUrlTrimmed,
    backendReady,
    auth.getAccessToken,
    threads.conversationId,
    threads.setConversationId,
    workspace.workspace,
    modelConfigForStream,
    agentSession.selectedGraphId || null,
    selectedGraphTitle,
    threads.loadThreads,
    diffs.setDiffs,
    activeWorkspaceId,
    categoriesHook.activeCategory
  );
  const capabilityDroppedToolsKey = useMemo(
    () => [...conversation.capabilityDroppedTools].sort().join("\0"),
    [conversation.capabilityDroppedTools],
  );
  const [capabilityToolsBannerDismissed, setCapabilityToolsBannerDismissed] = useState(false);
  useEffect(() => {
    setCapabilityToolsBannerDismissed(false);
  }, [capabilityDroppedToolsKey]);
  const git = useGit(workspace.workspace?.path ?? null, backendUrlTrimmed, auth.getAccessToken);

  const skillsHook = useSkills(backendUrlTrimmed, backendReady, auth.getAccessToken);

  // ── Resizable panels ──────────────────────────────────────────────────────
  const leftPanel = useResizablePanel({ storageKey: 'left-sidebar', defaultWidth: 260, minWidth: 180, maxWidth: 400, direction: 'left' });
  const rightPanel = useResizablePanel({ storageKey: 'right-sidebar', defaultWidth: 300, minWidth: 220, maxWidth: 500, direction: 'right' });
  const changesPanel = useResizablePanel({ storageKey: 'changes-panel', defaultWidth: 480, minWidth: 320, maxWidth: 720, direction: 'right' });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
  const [changesVisible, setChangesVisible] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);

  /** Restore Git sidebars when returning from Work → Code */
  const gitPanelsBeforeWorkRef = useRef({ rightOpen: true, changesOpen: false });
  const prevDesktopWorkModeRef = useRef(desktopWorkMode);

  useEffect(() => {
    const prev = prevDesktopWorkModeRef.current;
    const next = desktopWorkMode;
    if (prev === next) return;
    prevDesktopWorkModeRef.current = next;

    if (prev === "code" && next === "work") {
      gitPanelsBeforeWorkRef.current = {
        rightOpen: rightSidebarVisible,
        changesOpen: changesVisible,
      };
      setRightSidebarVisible(false);
      setChangesVisible(false);
    } else if (prev === "work" && next === "code") {
      const s = gitPanelsBeforeWorkRef.current;
      setRightSidebarVisible(s.rightOpen);
      setChangesVisible(s.changesOpen);
    }
  }, [desktopWorkMode, rightSidebarVisible, changesVisible]);
  const [openTabs, setOpenTabs] = useState<ConversationTab[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [contextChips, setContextChips] = useState<ContextChip[]>([]);
  const [multimodalOpen, setMultimodalOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [automationBuilderOpen, setAutomationBuilderOpen] = useState(false);
  const [createGraphBusy, setCreateGraphBusy] = useState(false);
  const editControl = useMessageEdit({
    sessionId: threads.conversationId,
    events: conversation.conversationEvents,
    streaming: conversation.streaming,
    onTruncateAndResend: conversation.truncateAndResend,
  });
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
        if (!isCodeMode) return;
        setRightSidebarVisible((p) => !p);
      }
      if (e.key === "g" && e.shiftKey) {
        e.preventDefault();
        if (!isCodeMode) return;
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
      // Add workspace: File → Add workspace… (Cmd+O) is handled via main-process IPC → onAddWorkspaceRequest
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
  }, [threads.conversationId, openTabs, isCodeMode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Reload threads when active workspace changes (e.g. after switchWorkspaceById or addProject)
  const prevActiveWsIdRef = useRef(activeWorkspaceId);
  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== prevActiveWsIdRef.current) {
      prevActiveWsIdRef.current = activeWorkspaceId;
      threads.resetThreads();
      conversation.resetConversation();
      diffs.resetDiffs();
      threads.setConversationId(null);
      void threads.loadThreads();
    }
  }, [activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh LLM config whenever the user opens Settings (config may have changed in the web UI)
  useEffect(() => {
    if (settings.activeView === "settings" && backendReady) {
      void models.loadModel();
      agentSession.refreshLlmPreferences();
    }
  }, [settings.activeView, backendReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      settings.activeView === "settings" &&
      settings.activeSettingsSection === "archived" &&
      backendReady &&
      activeWorkspaceId
    ) {
      void threads.loadArchivedThreads();
    }
  }, [settings.activeView, settings.activeSettingsSection, backendReady, activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sidebar Archived section — prefetch without opening Settings. */
  useEffect(() => {
    if (!backendReady || !activeWorkspaceId) return;
    void threads.loadArchivedThreads();
  }, [backendReady, activeWorkspaceId, threads.loadArchivedThreads]);

  useEffect(() => {
    const applyHash = () => {
      const h = (window.location.hash || "").replace(/^#\/?/, "");
      if (h === "automations") settings.setActiveView("automations");
      else if (h === "agent-graphs") settings.setActiveView("agent-graphs");
      else if (h === "settings") settings.setActiveView("settings");
      else if (h === "history") settings.setActiveView("history");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [settings.setActiveView]);

  useEffect(() => {
    const api = (window as {
      kletron?: {
        onNavigate?: (cb: (v: "app" | "history" | "automations" | "agent-graphs" | "settings") => void) => () => void;
      };
    }).kletron;
    if (!api?.onNavigate) return;
    return api.onNavigate((view) => {
      settings.setActiveView(view);
    });
  }, [settings.setActiveView]);

  /** Deep link: ?view= & ?automationId= & ?graphId= (once per load). */
  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (!backendReady || !auth.auth?.accessToken || deepLinkAppliedRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      if (view === "app" || view === "history" || view === "automations" || view === "agent-graphs" || view === "settings") {
        settings.setActiveView(view);
      }
      const graphId = params.get("graphId");
      if (graphId) {
        settings.setActiveView("agent-graphs");
        openPortalPath(`/app/agent-graphs/${encodeURIComponent(graphId)}`);
      }
      const automationId = params.get("automationId");
      if (automationId) {
        settings.setActiveView("automations");
        openPortalPath(`/app/automations/${encodeURIComponent(automationId)}`);
      }
      if (view || graphId || automationId) deepLinkAppliedRef.current = true;
    } catch {
      /* ignore */
    }
  }, [backendReady, auth.auth?.accessToken, settings.setActiveView, openPortalPath]);

  /** Deep link: ?sessionId= opens that thread (hash routes like #/automations are separate). */
  const sessionIdFromUrlApplied = useRef<string | null>(null);
  useEffect(() => {
    if (!backendReady || !auth.auth?.accessToken) return;
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("sessionId");
    if (!sid || sessionIdFromUrlApplied.current === sid) return;
    sessionIdFromUrlApplied.current = sid;
    threads.setConversationId(sid);
    void threads.loadThreads(sid);
  }, [backendReady, auth.auth?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = threads.conversationId;
    if (!id) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("sessionId", id);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${window.location.hash}`);
    } catch {
      // ignore
    }
  }, [threads.conversationId]);

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
    const activeRows = threads.threads.map((t) => ({
      id: t.id,
      title: t.title || "Untitled",
      updatedAt: t.updatedAt,
      archived: false as const,
      liveStatus: sessionStatusToSidebarLiveStatus(
        t.status,
        threads.conversationId === t.id && conversation.streaming,
      ),
    }));
    const archivedRows = threads.archivedThreads.map((t) => ({
      id: t.id,
      title: t.title || "Untitled",
      updatedAt: t.updatedAt,
      archived: true as const,
      liveStatus: "idle" as const,
    }));
    return [
      {
        id: workspace.workspace?.path ?? "default",
        name,
        threads: [...activeRows, ...archivedRows],
      },
    ];
  }, [
    threads.threads,
    threads.archivedThreads,
    threads.conversationId,
    conversation.streaming,
    workspace.workspace?.path,
    workspace.workspace?.name,
  ]);

  const threadSearchPaletteItems = useMemo(
    () =>
      sidebarProjects.flatMap((p) =>
        p.threads.map((t) => ({
          id: t.id,
          title: t.title,
          updatedAt: t.updatedAt,
          archived: t.archived,
          category: t.category,
        })),
      ),
    [sidebarProjects],
  );

  const workspaceThreadSearchLabel =
    workspace.workspace?.name ||
    workspace.workspace?.path?.split("/").pop() ||
    "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (sidebarProjects.length > 0) setThreadSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarProjects.length]);

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

  const graphsForPanel: AgentGraphSummary[] = useMemo(
    () =>
      agentSession.agentGraphs
        .map((g) => ({
          id: String(g._id ?? ""),
          name: g.name,
          description: g.description,
          updatedAt: undefined as string | undefined,
        }))
        .filter((g) => g.id),
    [agentSession.agentGraphs]
  );

  const agentGraphsLoading = agentSession.graphSelectorLoading;

  // Slash palette: library skills (GET /api/skills) + built-in commands
  const slashCommands: SlashCommandItem[] = useMemo(() => {
    const fromLibrary: SlashCommandItem[] = slashSkillRows.map((s) => ({
      id: `skill-${s.slug}`,
      sectionId: "skills",
      label: s.slug,
      description: s.description || undefined,
      // Prefix only — workspace skill injection stays server-side; user continues the message after the slug.
      action: () => conversation.setInput(`/${s.slug} `),
    }));
    const builtin: SlashCommandItem[] = [
      {
        id: "plan",
        sectionId: "commands",
        label: "plan",
        description: "Toggle Plan Mode (read-only proposals)",
        icon: <Eye className="h-3.5 w-3.5" />,
        action: () => {
          conversation.setInput("/plan ");
          setPlanMode((p) => !p);
        },
      },
      {
        id: "skills",
        sectionId: "commands",
        label: "skills",
        description: "Open Skills settings",
        icon: <Wrench className="h-3.5 w-3.5" />,
        action: () => {
          conversation.setInput("/skills ");
          settings.setActiveView("settings");
          settings.setActiveSettingsSection("skills");
        },
      },
      {
        id: "worktree",
        sectionId: "commands",
        label: "worktree",
        description: "Manage Git worktrees",
        icon: <GitBranch className="h-3.5 w-3.5" />,
        action: () => {
          conversation.setInput("/worktree ");
          settings.setActiveView("settings");
          settings.setActiveSettingsSection("worktrees");
        },
      },
    ];
    return [...fromLibrary, ...builtin];
  }, [slashSkillRows, conversation.setInput, settings]);

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
    conversation.stopStreaming();
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
    conversation.stopStreaming();
    conversation.resetConversation();
    diffs.resetDiffs();
    threads.setConversationId(null);
    void workspace.switchWorkspaceById(workspaceId);
  }

  const handleRemoveCurrentWorkspace = useCallback(() => {
    const path = workspace.workspace?.path;
    if (!path) return;
    const ok = window.confirm(
      "Remove this workspace from Kletron? Your threads remain on the server. You can add this folder again anytime.",
    );
    if (!ok) return;
    conversation.stopStreaming();
    conversation.resetConversation();
    threads.resetThreads();
    diffs.resetDiffs();
    workspace.clearWorkspace();
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("sessionId");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${window.location.hash}`);
    } catch {
      /* ignore */
    }
    toast.info("Workspace removed", "Choose a folder or add a project when you're ready.");
  }, [conversation, diffs, threads, toast, workspace]);

  async function handleAddProject() {
    try {
      const result = await (window as any).kletron?.selectWorkspace?.();
      if (!result) return; // user cancelled the dialog
      const folderPath: string = result.path;
      const folderName: string = result.name || folderPath.split("/").pop() || "Project";
      projectsHook.addProject(folderName, folderPath);
      // Register on the backend, switch to the new workspace, and refresh
      const token = await auth.getAccessToken();
      if (!token) {
        toast.error("Not authenticated", "Please sign in to add a workspace.");
        return;
      }
      const createRes = await fetch(`${backendUrlTrimmed}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rootPath: folderPath, name: folderName }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        toast.error("Failed to create workspace", (err as any)?.error ?? `Server returned ${createRes.status}`);
        return;
      }
      const data = await createRes.json();
      const newWsId = data?.workspace?.id;
      if (newWsId) {
        // Switch backend active workspace to the new one
        await workspace.switchWorkspaceById(newWsId);
      }
      await workspace.refreshAllWorkspaces();
      await workspace.loadWorkspaceSummary();
      // Reset threads and conversation for the new workspace
      threads.resetThreads();
      conversation.resetConversation();
      diffs.resetDiffs();
      threads.setConversationId(null);
      toast.info("Workspace added", `Now working in ${folderName}`);
    } catch (err) {
      console.error("[handleAddProject] Error:", err);
      toast.error("Failed to add workspace", (err as Error)?.message ?? "Unknown error");
    }
  }

  /** New thread + empty composer when switching Code ↔ Work so runs stay scoped to the mode. */
  const resetComposerForWorkModeChange = useCallback(() => {
    conversation.stopStreaming();
    conversation.resetConversation();
    diffs.resetDiffs();
    threads.setConversationId(null);
    setMessageQueue([]);
    setOpenTabs([]);
  }, [conversation, diffs, threads]);

  const handleWorkModeSelect = useCallback(
    (mode: WorkModeId) => {
      const prev = normalizeToWorkModeId(categoriesHook.activeCategory);
      if (mode === prev) return;
      void categoriesHook.setActiveCategory(mode);
      resetComposerForWorkModeChange();
      toast.info("Switched mode", WORK_MODES[mode].name);
    },
    [categoriesHook.activeCategory, categoriesHook.setActiveCategory, resetComposerForWorkModeChange, toast],
  );

  const toggleWorkMode = useCallback(() => {
    const cur = normalizeToWorkModeId(categoriesHook.activeCategory);
    const next: WorkModeId = cur === "code" ? "work" : "code";
    void categoriesHook.setActiveCategory(next);
    resetComposerForWorkModeChange();
    toast.info("Switched mode", WORK_MODES[next].name);
  }, [categoriesHook.activeCategory, categoriesHook.setActiveCategory, toast, resetComposerForWorkModeChange]);

  const handleAddProjectRef = useRef(handleAddProject);
  handleAddProjectRef.current = handleAddProject;
  const toggleWorkModeRef = useRef(toggleWorkMode);
  toggleWorkModeRef.current = toggleWorkMode;
  const setActiveViewRef = useRef(settings.setActiveView);
  setActiveViewRef.current = settings.setActiveView;

  useEffect(() => {
    const k = window.kletron;
    if (!k?.onAddWorkspaceRequest) return;
    const u1 = k.onAddWorkspaceRequest(() => void handleAddProjectRef.current());
    const u2 = k.onOpenSettingsRequest?.(() => setActiveViewRef.current("settings"));
    const u3 = k.onToggleWorkModeRequest?.(() => toggleWorkModeRef.current());
    return () => {
      u1();
      u2?.();
      u3?.();
    };
  }, []);

  function handleThreadSelect(threadId: string) {
    if (threadId === threads.conversationId) return;
    conversation.stopStreaming();
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

    void conversation.sendMessage({ planMode });
  }

  /** Send a specific text directly (used by queue dequeue). */
  function sendTextDirectly(text: string) {
    void conversation.sendMessage({ planMode, text });
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
    if (
      slashMenuOpen &&
      (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey))
    ) {
      // SlashCommandMenu handles selection on document capture; avoid sending the message.
      e.preventDefault();
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
  // HISTORY VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (settings.activeView === "history") {
    return (
      <DesktopWorkspaceProvider
        backendUrlTrimmed={backendUrlTrimmed}
        getAccessToken={auth.getAccessToken}
        workspace={workspace}
      >
        <div className="flex h-screen flex-col text-text-primary min-h-0">
          <header className="flex h-10 shrink-0 items-center glass-titlebar px-4 pl-[76px] app-region-drag">
            <span className="text-xs font-medium text-text-secondary">History</span>
          </header>
          <DesktopPrimaryNav activeView={settings.activeView} onSelect={(v) => settings.setActiveView(v)} />
          <HistoryPanel
            backendUrlTrimmed={backendUrlTrimmed}
            backendReady={backendReady}
            getAccessToken={auth.getAccessToken}
            activeWorkspaceId={activeWorkspaceId}
            onOpenThread={(sessionId) => {
              settings.setActiveView("app");
              threads.setConversationId(sessionId);
              void threads.loadThreads(sessionId);
            }}
            onOpenFullHistoryPortal={() => openPortalPath("/app/history")}
          />
        </div>
      </DesktopWorkspaceProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATIONS VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (settings.activeView === "automations") {
    return (
      <DesktopWorkspaceProvider
        backendUrlTrimmed={backendUrlTrimmed}
        getAccessToken={auth.getAccessToken}
        workspace={workspace}
      >
        <div className="flex h-screen flex-col text-text-primary min-h-0">
          <header className="flex h-10 shrink-0 items-center justify-between glass-titlebar px-4 pl-[76px] app-region-drag">
            <span className="text-xs font-medium text-text-secondary">Automations</span>
            <Button
              size="xs"
              variant="secondary"
              className="app-region-no-drag"
              onClick={() => setAutomationBuilderOpen(true)}
            >
              New automation
            </Button>
          </header>
          <DesktopPrimaryNav activeView={settings.activeView} onSelect={(v) => settings.setActiveView(v)} />
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 scrollbar-elegant">
            {automationsHook.error && (
              <div className="mb-2 rounded border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-text">
                {automationsHook.error}
              </div>
            )}
            <AutomationsDashboard
              automations={automationsHook.automations}
              loading={automationsHook.loading}
              onRemove={(id) => void automationsHook.remove(id)}
              onRunNow={async (id) => {
                const tid = await automationsHook.runNow(id);
                if (tid) {
                  settings.setActiveView("app");
                  threads.setConversationId(tid);
                  void threads.loadThreads(tid);
                }
              }}
              onOpenInBrowser={(id) => openPortalPath(`/app/automations/${encodeURIComponent(id)}`)}
              onOpenThread={(sessionId) => {
                settings.setActiveView("app");
                threads.setConversationId(sessionId);
                void threads.loadThreads(sessionId);
              }}
            />
          </div>
          <AutomationBuilderModal
            open={automationBuilderOpen}
            onClose={() => setAutomationBuilderOpen(false)}
            apiFetch={apiFetch}
            onCreated={() => {
              setAutomationBuilderOpen(false);
              void automationsHook.load();
            }}
          />
        </div>
      </DesktopWorkspaceProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT GRAPHS VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (settings.activeView === "agent-graphs") {
    return (
      <DesktopWorkspaceProvider
        backendUrlTrimmed={backendUrlTrimmed}
        getAccessToken={auth.getAccessToken}
        workspace={workspace}
      >
        <div className="flex h-screen flex-col text-text-primary min-h-0">
          <header className="flex h-10 shrink-0 items-center glass-titlebar px-4 pl-[76px] app-region-drag">
            <span className="text-xs font-medium text-text-secondary">Agent graphs</span>
          </header>
          <DesktopPrimaryNav activeView={settings.activeView} onSelect={(v) => settings.setActiveView(v)} />
          <AgentGraphsPanel
            backendUrlTrimmed={backendUrlTrimmed}
            getAccessToken={auth.getAccessToken}
            activeWorkspaceId={activeWorkspaceId}
            graphs={graphsForPanel}
            graphsLoading={agentGraphsLoading}
            graphRuns={models.graphRuns}
            graphRunsLoading={models.graphRunsLoading}
            loadGraphRuns={models.loadGraphRuns}
            apiFetch={apiFetch}
            onOpenRunInAgent={(runId) => {
              settings.setActiveView("app");
              threads.setConversationId(runId);
              void threads.loadThreads(runId);
            }}
            onOpenGraphInBrowser={(gid) => openPortalPath(`/app/agent-graphs/${encodeURIComponent(gid)}`)}
            onOpenRunInBrowser={(gid, rid) =>
              openPortalPath(`/app/agent-graphs/${encodeURIComponent(gid)}/runs/${encodeURIComponent(rid)}`)
            }
            onCreateGraph={async () => {
              setCreateGraphBusy(true);
              try {
                const id = await models.createAgentGraph();
                if (id) {
                  await agentSession.refreshGraphs();
                  openPortalPath(`/app/agent-graphs/${encodeURIComponent(id)}`);
                }
              } finally {
                setCreateGraphBusy(false);
              }
            }}
            createGraphBusy={createGraphBusy}
          />
        </div>
      </DesktopWorkspaceProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (settings.activeView === "settings") {
    return (
      <DesktopWorkspaceProvider
        backendUrlTrimmed={backendUrlTrimmed}
        getAccessToken={auth.getAccessToken}
        workspace={workspace}
      >
      <div className="flex h-screen flex-col text-text-primary min-h-0">
        <header className="flex h-10 shrink-0 items-center glass-titlebar px-4 pl-[76px] app-region-drag">
          <span className="text-xs font-medium text-text-secondary">Settings</span>
        </header>
        <DesktopPrimaryNav activeView={settings.activeView} onSelect={(v) => settings.setActiveView(v)} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <aside className="flex w-60 flex-col glass-sidebar px-2 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Sections</div>
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
              {/* Configuration — backend, models, portal-backed intelligence (read-only summaries) */}
              {settings.activeSettingsSection === "configuration" && (
                <>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Backend</h2>
                    <SettingsCard>
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div><div className="text-sm font-medium text-text-primary">Backend URL</div><div className="text-xs text-text-muted">Connect to your Kletron backend.</div></div>
                        <input
                          value={settings.backendUrl}
                          onChange={(e) => settings.setBackendUrl(e.target.value)}
                          className="w-56 rounded-md bg-bg-app px-2 py-1 text-xs text-text-primary ring-1 ring-inset ring-border-subtle/90 focus:outline-none focus:ring-border-strong"
                          placeholder="https://app.kletron.com"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div className="text-sm font-medium text-text-primary">Backend reachability</div>
                        <span className={`flex items-center gap-1.5 text-xs ${backendConnected ? "text-status-success-text" : "text-status-error-text"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${backendConnected ? "bg-status-success" : "bg-status-error"}`} />
                          {!backendUrlValid
                            ? "Invalid URL"
                            : backendConnected
                              ? "Reachable"
                              : "Unreachable"}
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
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-text-primary">Web portal</div>
                          <div className="text-xs text-text-muted">Organization, billing, and full workspace settings in the browser.</div>
                        </div>
                        <Button size="xs" variant="ghost" onClick={() => openPortalPath("/app")}>
                          Open in browser
                        </Button>
                      </div>
                    </SettingsCard>
                  </section>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Models</h2>
                    <LLMSelector providers={models.providers} selectedProvider={models.selectedProvider} selectedModel={models.selectedModel} onProviderChange={models.changeProvider} onModelChange={models.changeModel} />
                  </section>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Embeddings &amp; context</h2>
                    <p className="text-xs text-text-muted">
                      Read-only snapshot from your workspace. Edit vectors, injection, and related options in the web app.
                    </p>
                    {portalConfigSnapshot.error && (
                      <div className="text-xs text-status-error-text">{portalConfigSnapshot.error}</div>
                    )}
                    <SettingsCard>
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-text-primary">Embeddings</div>
                          <div className="text-xs text-text-muted">
                            {portalConfigSnapshot.loading
                              ? "Loading…"
                              : !activeWorkspaceId
                                ? "Select a workspace to view status"
                                : (portalConfigSnapshot.embeddingLine ?? "—")}
                          </div>
                        </div>
                        <Button size="xs" variant="ghost" onClick={() => openPortalPath("/app/config/embeddings")}>
                          Edit in portal
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-text-primary">Context injection</div>
                          <div className="text-xs text-text-muted">
                            {portalConfigSnapshot.loading
                              ? "Loading…"
                              : !activeWorkspaceId
                                ? "Select a workspace to view status"
                                : (portalConfigSnapshot.contextLine ?? "—")}
                          </div>
                        </div>
                        <Button size="xs" variant="ghost" onClick={() => openPortalPath("/app/config/context")}>
                          Edit in portal
                        </Button>
                      </div>
                    </SettingsCard>
                  </section>
                </>
              )}
              {settings.activeSettingsSection === "portal" && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Web portal</h2>
                    <p className="text-xs text-text-muted">
                      Organization, billing, account, and full workspace configuration open in your browser at the same host as your backend URL.
                    </p>
                  </div>
                  {PORTAL_LINK_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{group.title}</h3>
                      <SettingsCard>
                        {group.items.map((item) => (
                          <div key={item.path} className="flex items-center justify-between gap-4 px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-text-primary">{item.label}</div>
                              {item.description ? (
                                <div className="text-xs text-text-muted">{item.description}</div>
                              ) : null}
                            </div>
                            <Button size="xs" variant="ghost" onClick={() => openPortalPath(item.path)}>
                              Open in browser
                            </Button>
                          </div>
                        ))}
                      </SettingsCard>
                    </div>
                  ))}
                </section>
              )}
              {/* General — local desktop toggles only */}
              {settings.activeSettingsSection === "general" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">General</h2>
                  <SettingsCard>
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div><div className="text-sm font-medium text-text-primary">Prevent sleep while running</div><div className="text-xs text-text-muted">Keep your computer awake while the agent runs.</div></div>
                      <Toggle size="sm" checked={settings.settingsToggles.preventSleep} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, preventSleep: c }))} />
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div><div className="text-sm font-medium text-text-primary">Require Cmd+Enter to send</div><div className="text-xs text-text-muted">Multiline prompts require Cmd+Enter to send.</div></div>
                      <Toggle size="sm" checked={settings.settingsToggles.requireCmdEnter} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, requireCmdEnter: c }))} />
                    </div>
                  </SettingsCard>
                </section>
              )}
              {/* Personalization */}
              {settings.activeSettingsSection === "personalization" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Appearance</h2>
                  <SettingsCard>
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div><div className="text-sm font-medium text-text-primary">Compact density</div><div className="text-xs text-text-muted">Reduce padding across the interface.</div></div>
                      <Toggle size="sm" checked={settings.settingsToggles.compactDensity} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, compactDensity: c }))} />
                    </div>
                  </SettingsCard>
                </section>
              )}
              {/* MCP */}
              {settings.activeSettingsSection === "mcp" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">MCP Servers</h2>
                  <DeviceOnlyPortalBanner portalPath="/app/config/connectors" onOpenPortal={openPortalPath} />
                  <SettingsCard>
                    <div className="p-0">
                      <MCPServerConfig
                        embeddedInCard
                        servers={mcpServers}
                        onAdd={(s) => setMcpServers((p) => [...p, { ...s, id: crypto.randomUUID(), enabled: true, status: "disconnected" }])}
                        onRemove={(id) => setMcpServers((p) => p.filter((s) => s.id !== id))}
                        onToggle={(id, enabled) => setMcpServers((p) => p.map((s) => (s.id === id ? { ...s, enabled } : s)))}
                      />
                    </div>
                  </SettingsCard>
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
                  <p className="text-xs text-text-muted">
                    Manage automations in the dedicated view for full create/edit, or browse the list below.
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => settings.setActiveView("automations")}>
                    Open automations
                  </Button>
                  {automationsHook.error && (
                    <div className="text-xs text-status-error-text">{automationsHook.error}</div>
                  )}
                  <AutomationsDashboard
                    automations={automationsHook.automations}
                    loading={automationsHook.loading}
                    onRemove={(id) => void automationsHook.remove(id)}
                    onRunNow={async (id) => {
                      const tid = await automationsHook.runNow(id);
                      if (tid) {
                        settings.setActiveView("app");
                        threads.setConversationId(tid);
                        void threads.loadThreads(tid);
                      }
                    }}
                    onOpenInBrowser={(id) => openPortalPath(`/app/automations/${encodeURIComponent(id)}`)}
                    onOpenThread={(sessionId) => {
                      settings.setActiveView("app");
                      threads.setConversationId(sessionId);
                      void threads.loadThreads(sessionId);
                    }}
                  />
                </section>
              )}
              {/* Agent Graphs */}
              {settings.activeSettingsSection === "graphs" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Agent Graphs</h2>
                  <DeviceOnlyPortalBanner portalPath="/app/agent-graphs" onOpenPortal={openPortalPath} />
                  <p className="text-xs text-text-muted">
                    Agent graphs define different workflows for the AI. Select a graph when starting a conversation to guide the agent's behavior.
                  </p>
                  {agentGraphsLoading && (
                    <div className="glass-card rounded-md px-3 py-4 text-center text-text-muted">
                      <AgentStatusShimmerLabel className="text-xs">Loading graphs...</AgentStatusShimmerLabel>
                    </div>
                  )}
                  {!agentGraphsLoading && graphsForPanel.length === 0 && (
                    <div className="glass-card rounded-md px-3 py-4 text-xs text-text-muted text-center">
                      No agent graphs available. Configure them in the web portal.
                    </div>
                  )}
                  <div className="space-y-2">
                    {graphsForPanel.map((graph) => (
                      <div
                        key={graph.id}
                        className={`rounded-md px-3 py-2.5 transition-colors cursor-pointer ${agentSession.selectedGraphId === graph.id
                          ? "glass-selected"
                          : "glass-card"
                          }`}
                        onClick={() => agentSession.handleGraphChange(graph.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-text-muted" />
                            <span className="text-sm font-medium text-text-primary">{graph.name}</span>
                          </div>
                          {agentSession.selectedGraphId === graph.id && (
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
                  <Button size="sm" variant="secondary" onClick={() => agentSession.refreshGraphs()} disabled={agentGraphsLoading}>
                    Reload Graphs
                  </Button>
                </section>
              )}
              {/* Environments */}
              {settings.activeSettingsSection === "environments" && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Environment Variables</h2>
                  <DeviceOnlyPortalBanner portalPath="/app/config/workspace" onOpenPortal={openPortalPath} />
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
                  <DeviceOnlyPortalBanner portalPath="/app/config/workspace" onOpenPortal={openPortalPath} />
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
                  <h2 className="text-sm font-semibold text-text-primary">Archived threads</h2>
                  <p className="text-xs text-text-muted">
                    Threads archived from the sidebar. Open one to continue the conversation in the agent view.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void threads.loadArchivedThreads()}
                    disabled={threads.archivedLoading}
                  >
                    {threads.archivedLoading ? "Loading…" : "Refresh list"}
                  </Button>
                  <div className="space-y-2">
                    {threads.archivedThreads.length === 0 && !threads.archivedLoading && (
                      <div className="glass-card px-3 py-4 text-xs text-text-muted text-center rounded-md">
                        No archived threads.
                      </div>
                    )}
                    {threads.archivedThreads.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 glass-card px-3 py-2 rounded-md"
                      >
                        <span className="text-sm truncate min-w-0">{t.title || t.id}</span>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            settings.setActiveView("app");
                            threads.setConversationId(t.id);
                            void threads.loadThreads(t.id);
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
      </DesktopWorkspaceProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMAND CENTER VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <DesktopWorkspaceProvider
      backendUrlTrimmed={backendUrlTrimmed}
      getAccessToken={auth.getAccessToken}
      workspace={workspace}
    >
    <div className="flex h-screen flex-col text-text-primary">
      {/* ── Title Bar ── */}
      <TitleBar
        workspaceName={workspace.workspace?.name || workspace.workspace?.path?.split("/").pop() || "Kletron Desktop"}
        workspaceSelectorLabel={workspace.workspace?.name || workspace.workspace?.path?.split("/").pop() || "Select workspace"}
        onWorkspaceSelectorClick={() => { void workspace.selectWorkspace(); }}
        workspaceItems={workspace.allWorkspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceSelect={handleWorkspaceSelect}
        onAddWorkspace={handleAddProject}
        onRemoveWorkspace={workspace.workspace?.path ? handleRemoveCurrentWorkspace : undefined}
        showTrafficLights={false}
        openEditorLabel={isCodeMode ? "VS Code" : "Folder"}
        openEditorTitle={
          isCodeMode
            ? "Open workspace in Visual Studio Code"
            : "Open workspace folder in Finder / File Explorer"
        }
        openActionVariant={isCodeMode ? "vscode" : "native-folder"}
        onOpen={() => {
          try {
            const k = (
              window as {
                kletron?: {
                  openInVSCode?: (p?: string) => Promise<boolean>;
                  openWorkspaceInSystemFileManager?: (p?: string) => Promise<boolean>;
                };
              }
            ).kletron;
            const p = workspace.workspace?.path;
            if (isCodeMode) void k?.openInVSCode?.(p);
            else void k?.openWorkspaceInSystemFileManager?.(p);
          } catch {
            /* ignore */
          }
        }}
        onCommit={
          isCodeMode
            ? () => {
                setRightSidebarVisible(true);
              }
            : undefined
        }
        onPush={isCodeMode ? () => void git.push() : undefined}
        onCreatePR={
          isCodeMode
            ? () => {
                const title = git.commitMessage.trim() || `PR from ${git.gitStatus?.branch ?? "branch"}`;
                void git.push().then(() =>
                  git.createPR(title).then((result) => {
                    if (result?.url) {
                      try {
                        (window as { kletron?: { openExternal?: (u: string) => Promise<boolean> } }).kletron?.openExternal?.(
                          result.url,
                        );
                      } catch {
                        /* ignore */
                      }
                    }
                  }),
                );
              }
            : undefined
        }
        committing={isCodeMode ? git.committing : false}
        pushing={isCodeMode ? git.pushing : false}
        creatingPR={isCodeMode ? git.creatingPR : false}
        hideLeadingWorkspaceLabel={sidebarProjects.length > 0}
        center={
          sidebarProjects.length > 0 ? (
            <ThreadSearchHeaderTrigger
              onClick={() => setThreadSearchOpen(true)}
              placeholder={workspaceThreadSearchLabel}
              disabled={workspace.switching || threads.threadsLoading}
              density="compact"
              className="w-full min-w-[200px] max-w-[min(100%,42rem)]"
            />
          ) : undefined
        }
        threadTitle={sidebarProjects.length > 0 ? undefined : activeThreadTitle}
        onToggleTerminal={isCodeMode ? () => setTerminalVisible((p) => !p) : undefined}
        onToggleChanges={
          isCodeMode
            ? () => {
                setChangesVisible((p) => {
                  if (!p) void git.fetchAllDiffs();
                  return !p;
                });
              }
            : undefined
        }
        changesVisible={isCodeMode ? changesVisible : false}
        onToggleSourceControl={
          isCodeMode ? () => setRightSidebarVisible((p) => !p) : undefined
        }
        sourceControlVisible={isCodeMode ? rightSidebarVisible : false}
        gitDiffStats={isCodeMode ? (git.diffStats ?? undefined) : undefined}
      />

      <AgentSessionChrome
        workMode={desktopWorkMode}
        onWorkModeChange={handleWorkModeSelect}
        showWorkModeSwitcher={false}
        suppressFirstRow={sidebarProjects.length > 0}
        workspaceName={workspace.workspace?.name ?? workspace.workspace?.path?.split("/").pop() ?? null}
        workspaceRootPath={workspace.workspace?.path ?? null}
        codeModeSecondRow={
          isCodeMode && activeWorkspaceId ? (
            <CodeRepoConnectorStrip
              apiOrigin={backendUrlTrimmed}
              workspaceId={activeWorkspaceId}
              getRequestHeaders={getAgentRequestHeaders}
              onOpenConnectorsPortal={() =>
                openPortalPath(`/app/app/${encodeURIComponent(activeWorkspaceId)}/connectors`)
              }
            />
          ) : undefined
        }
      />

      <DesktopPrimaryNav activeView={settings.activeView} onSelect={(v) => settings.setActiveView(v)} />

      {/* ── Three-Pane Body ── */}
      <div className="app-region-no-drag flex flex-1 min-h-0 relative">
        {/* Left Sidebar: Project Navigation */}
        {sidebarVisible && (
          <>
          <ProjectSidebar
            projects={sidebarProjects}
            activeThreadId={threads.conversationId}
            activeProjectId={workspace.workspace?.path ?? null}
            loading={workspace.switching || threads.threadsLoading}
            workMode={desktopWorkMode}
            onWorkModeChange={handleWorkModeSelect}
            workModeSwitcherDisabled={workspace.switching || threads.threadsLoading}
            onThreadSelect={handleThreadSelect}
            onNewThreadInProject={handleNewThreadInProject}
            onAddProject={handleAddProject}
            showAddProjectButton={false}
            onSettings={() => settings.setActiveView("settings")}
            onRenameThread={(threadId, newTitle) => {
              threads.startEditThread({ id: threadId, title: newTitle });
              threads.setEditingThreadTitle(newTitle);
              void threads.saveEditedThreadTitle();
            }}
            onArchiveThread={(threadId) => void threads.archiveThread(threadId)}
            onDeleteThread={(threadId) => void threads.deleteThread(threadId)}
            onRemoveProject={(projectId) => {
              const path = workspace.workspace?.path;
              if (!path || !pathsEqual(projectId, path)) return;
              handleRemoveCurrentWorkspace();
            }}
            style={{ width: leftPanel.width }}
          />
          <ResizeHandle
            onMouseDown={leftPanel.startDrag}
            onDoubleClick={leftPanel.resetToDefault}
            active={leftPanel.isDragging}
          />
          </>
        )}

        {/* Center: Conversation Workspace */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Conversation Messages */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-elegant">
            {/* Same horizontal measure as web agent page (max-w-3xl + px-2 thread padding) */}
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
              {conversation.capabilityDroppedTools.length > 0 &&
                !(conversation.conversationLoading && threads.conversationId) &&
                !capabilityToolsBannerDismissed && (
                <div className="px-2 pt-3">
                  <div
                    className="flex flex-col gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[11px] text-status-warning-text sm:flex-row sm:items-start sm:gap-3"
                    role="status"
                  >
                    <p className="min-w-0 flex-1 leading-snug">
                      This graph can use{" "}
                      <span className="font-medium text-status-warning-text">
                        {formatDroppedToolsListPhrase(conversation.capabilityDroppedTools)}
                      </span>
                      {CAPABILITY_DROPPED_BANNER_TAIL}
                    </p>
                    <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-1 sm:flex-col sm:items-end sm:justify-start">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-status-warning-text underline-offset-2 hover:underline"
                        onClick={() =>
                          openPortalPath(
                            activeWorkspaceId
                              ? `/app/app/${encodeURIComponent(activeWorkspaceId)}/connectors`
                              : "/app/config/connectors",
                          )
                        }
                      >
                        <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Connectors
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-status-warning-text underline-offset-2 hover:underline"
                        onClick={() =>
                          openPortalPath(
                            activeWorkspaceId
                              ? `/app/app/${encodeURIComponent(activeWorkspaceId)}/skills`
                              : "/app/config/skills",
                          )
                        }
                      >
                        <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Skills
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-status-warning-text hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Dismiss"
                        onClick={() => setCapabilityToolsBannerDismissed(true)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {conversation.capabilityDroppedTools.length > 0 &&
                !(conversation.conversationLoading && threads.conversationId) &&
                capabilityToolsBannerDismissed && (
                <div className="px-2 pt-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-1.5 text-[10px] font-medium text-status-warning-text hover:opacity-90"
                    title={capabilityDroppedSlimBarTitle(conversation.capabilityDroppedTools)}
                    onClick={() => setCapabilityToolsBannerDismissed(false)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {CAPABILITY_DROPPED_SLIM_CTA_LABEL}
                  </button>
                </div>
              )}
              {conversation.conversationLoading && threads.conversationId ? (
                <ConversationThreadSkeleton className="flex-1 min-h-0" />
              ) : (
                <MessageList
                  events={conversation.renderItems.flatMap(i => i.type === 'event' ? [i.event] : i.events)}
                  streaming={conversation.streaming}
                  streamingText={conversation.streamingText}
                  streamingReasoning={conversation.streamingReasoning}
                  activityEvents={conversation.conversationEvents}
                  pendingApprovalCount={conversation.sessionEdits.pendingEdits.length}
                  hasOlder={conversation.historyPage.hasOlder}
                  loadingOlder={conversation.loadingOlder}
                  onLoadOlder={() => void conversation.onLoadOlderMessages()}
                  virtualized
                  prefetchNearTop
                  onNearTop={() => void conversation.onLoadOlderMessages()}
                  className="flex-1 min-h-0 p-0 px-2 py-4"
                  messageActions={(event) => (
                    <MessageActions
                      event={event}
                      onStartEdit={() => editControl.startEditMessage(event.messageIndex!, event.content ?? "")}
                    />
                  )}
                />
              )}
              {isCodeMode && inlineDiffs.length > 0 && !(conversation.conversationLoading && threads.conversationId) && (
                <InlineDiffReview
                  diffs={inlineDiffs}
                  onAccept={(editId) => {
                    void (async () => {
                      await conversation.sessionEdits.approveEdit(editId);
                      await diffs.applyAllDiff(editId);
                    })();
                  }}
                  onReject={(editId) => {
                    void conversation.sessionEdits.rejectEdit(editId);
                    diffs.rejectAllDiff(editId);
                  }}
                  onOpenInIDE={(filePath) => {
                    try { (window as any).kletron?.openInVSCode?.(filePath); } catch { /* ignore */ }
                  }}
                  onRequestIteration={handleRequestIteration}
                />
              )}
              {conversation.sendError && (
                <div className="mx-2 my-2 rounded border border-status-error-border bg-status-error-bg px-3 py-2 text-[12px] text-status-error-text">
                  {conversation.sendError}
                </div>
              )}
            </div>
          </div>

          {/* Work mode: same compact approvals as web agent (Code mode uses InlineDiffReview above). */}
          {!isCodeMode && (
            <PendingSessionEditsStrip
              pendingEdits={conversation.sessionEdits.pendingEdits}
              flushNotice={conversation.sessionEdits.flushNotice}
              dismissFlushNotice={conversation.sessionEdits.dismissFlushNotice}
              processingOp={conversation.sessionEdits.processingOp}
              approvingAll={conversation.sessionEdits.approvingAll}
              rejectingAll={conversation.sessionEdits.rejectingAll}
              approveEdit={async (editId, toolName) => {
                await conversation.sessionEdits.approveEdit(editId, toolName);
                await diffs.applyAllDiff(editId);
              }}
              rejectEdit={(editId, toolName) => {
                void conversation.sessionEdits.rejectEdit(editId, toolName);
                diffs.rejectAllDiff(editId);
              }}
              approveAll={async () => {
                await conversation.sessionEdits.approveAll();
                diffs.resetDiffs();
              }}
              rejectAll={async () => {
                await conversation.sessionEdits.rejectAll();
                diffs.resetDiffs();
              }}
            />
          )}

          {/* Input Bar */}
          <div className="relative z-10 mx-auto w-full max-w-3xl shrink-0 app-region-no-drag">
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
                  const paths = await (window as any).kletron?.pickFile?.();
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
                  await (window as any).kletron?.captureScreenshot?.();
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
              className="mx-auto w-full max-w-3xl"
            />
            <InputBar
              value={conversation.input}
              onChange={conversation.setInput}
              onSend={handleSendMessage}
              onStop={conversation.stopStreaming}
              sending={conversation.streaming}
              disabled={composerConnection.composerDisabled}
              placeholder={
                conversation.streaming
                  ? "Add a follow-up (queued until agent finishes)..."
                  : planMode
                    ? "Describe what you want to plan..."
                    : "Ask anything…"
              }
              onKeyDown={handleInputKeyDown}
              contextChips={contextChips}
              onDismissChip={(id) => setContextChips((p) => p.filter((c) => c.id !== id))}
              onPaperclipClick={() => setMultimodalOpen((p) => !p)}
              planMode={planMode}
              connected={composerConnection.connected}
              connectionLabel={composerConnection.connectionLabel}
              tokenUsage={conversation.tokenUsage}
              graphSelector={
                <Selector
                  label="GRAPH"
                  value={agentSession.selectedGraphId}
                  options={agentSession.graphSelectOptions}
                  onSelect={agentSession.handleGraphChange}
                  size="sm"
                  direction="up"
                  loading={agentGraphsLoading}
                  menuAlign="end"
                />
              }
              modelSelector={
                <Selector
                  label="LLM"
                  value={agentSession.llmProvider}
                  options={agentSession.llmOptions}
                  onSelect={agentSession.handleLlmChange}
                  size="sm"
                  direction="up"
                  loading={agentSession.llmSelectorLoading}
                  status={agentSession.llmSelectorLoading ? "none" : agentSession.llmStatus}
                  menuAlign="end"
                  statusTooltip={agentSession.llmSelectorLoading ? null : agentSession.llmStatusDetail}
                />
              }
              approvalSelector={
                <ThreadApprovalModeSelector
                  value={conversation.threadApprovalMode}
                  onSelect={conversation.onThreadApprovalSelect}
                  disabled={conversation.conversationRunSource === "automation"}
                  disabledReason="Approval mode is fixed for automation threads."
                />
              }
            />
          </div>

          {/* ── Collapsible Terminal Panel (below input bar) ── */}
          {terminalVisible && (
            <div className="border-t border-white/[0.06] flex flex-col" style={{ height: 220 }}>
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

        {/* Middle Panel: Uncommitted Changes Diffs (Code mode only) */}
        {isCodeMode && changesVisible && (
          <>
          <ResizeHandle
            onMouseDown={changesPanel.startDrag}
            onDoubleClick={changesPanel.resetToDefault}
            active={changesPanel.isDragging}
          />
          <div className="flex-shrink-0" style={{ width: changesPanel.width }}>
            <UncommittedChangesPanel
              fileDiffs={uncommittedFileDiffs}
              loading={git.allDiffsLoading}
              onClose={() => setChangesVisible(false)}
              onOpenInIDE={(p) => {
                try { (window as any).kletron?.openInVSCode?.(p); } catch { /* ignore */ }
              }}
              onStageFile={(p) => { void git.stageFile(p).then(() => git.fetchAllDiffs()); }}
              onRevertFile={(p) => { void git.revertFile(p).then(() => git.fetchAllDiffs()); }}
              onRevertAll={() => { void git.revertAll().then(() => git.fetchAllDiffs()); }}
              onStageAll={() => { void git.stageAll().then(() => git.fetchAllDiffs()); }}
            />
          </div>
          </>
        )}

        {/* Right Sidebar: Source Control (Code mode only — Work mode hides Git UI) */}
        {isCodeMode && rightSidebarVisible && (
          <>
          <ResizeHandle
            onMouseDown={rightPanel.startDrag}
            onDoubleClick={rightPanel.resetToDefault}
            active={rightPanel.isDragging}
          />
          <ProjectUtilitySidebar
            fileLinks={fileLinks}
            pendingDiffs={pendingDiffItems}
            onOpenDiff={(editId) => {
              // Scroll to diff in conversation
            }}
            onAcceptDiff={(editId) => diffs.applyAllDiff(editId)}
            onRejectDiff={(editId) => diffs.rejectAllDiff(editId)}
            onOpenInIDE={(filePath) => {
              try { (window as any).kletron?.openInVSCode?.(filePath); } catch { /* ignore */ }
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
            style={{ width: rightPanel.width }}
          />
          </>
        )}
      </div>

      {/* Replay Confirmation Dialog */}
      <ReplayConfirmDialog
        open={editControl.replayDialogOpen}
        impact={editControl.replayImpact}
        onConfirm={() => void editControl.executeReplay()}
        onCancel={editControl.cancelReplay}
        loading={editControl.editingMessageSaving}
      />

      <ThreadSearchPalette
        open={threadSearchOpen}
        onClose={() => setThreadSearchOpen(false)}
        threads={threadSearchPaletteItems}
        activeThreadId={threads.conversationId}
        onSelect={handleThreadSelect}
        placeholder="Search threads…"
      />
    </div>
    </DesktopWorkspaceProvider>
  );
}
