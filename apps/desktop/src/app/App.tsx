import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronDown, ChevronRight, Settings, Pencil, Check, X,
  Archive, Trash2, Terminal as TerminalIcon, MessageSquare, ListTodo,
  Files, Search, GitBranch, Brain, FileCode,
} from "lucide-react";

// Design system components
import {
  Button,
  ChatInput,
  Textarea,
  Toggle,
  ThreadFeed,
  LLMSelector,
  MCPServerConfig,
  EnvironmentConfig,
  WorktreeManager,
  ToolInvocation,
  MarkdownRenderer,
  TrafficLights,
  ActivityBar,
  FileBrowser,
  CodeEditor,
  DiffEditor,
  EditorTabs,
  CommandPalette,
  StatusBar,
  GitPanel,
  ContextChips,
  createFileChip,
  ThinkingBubble,
} from "@numezis/ui/components/design-system";
import type { EditorTab } from "@numezis/ui/components/design-system";
import type { ActivityBarItem } from "@numezis/ui/components/design-system";
import type { CommandItem } from "@numezis/ui/components/design-system";
import type { ContextChip } from "@numezis/ui/components/design-system";
import { Terminal } from "@numezis/ui/components/Terminal";

// Hooks
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { useWorkspace } from "../hooks/useWorkspace";
import { useThreads } from "../hooks/useThreads";
import { useConversation } from "../hooks/useConversation";
import { useDiffs } from "../hooks/useDiffs";
import { useModels } from "../hooks/useModels";
import { useGit } from "../hooks/useGit";
import { useFileExplorer } from "../hooks/useFileExplorer";

// Panels
import { SearchPanel } from "./panels/SearchPanel";
import { TodoPanel } from "./panels/TodoPanel";
import type { TodoItem } from "./panels/TodoPanel";

// Utils & types
import type { MCPServer, EnvVariable, Worktree } from "../types";
import { SETTINGS_SECTIONS, formatRelativeTime } from "../utils";

// ─── Side panel type ─────────────────────────────────────────────────────────
type SidePanel = "explorer" | "search" | "git" | "todo" | "chat";

export default function App() {
  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS & BUSINESS LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

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
  const models = useModels(backendUrlTrimmed, backendReady, auth.getAccessToken);
  const threads = useThreads(backendUrlTrimmed, backendReady, auth.getAccessToken);
  const diffs = useDiffs(workspace.workspace);
  const conversation = useConversation(
    backendUrlTrimmed, backendReady, auth.getAccessToken,
    threads.conversationId, threads.setConversationId,
    workspace.workspace, models.modelConfig, models.selectedGraph,
    models.selectedGraphName, threads.loadThreads, diffs.setDiffs
  );
  const git = useGit(workspace.workspace?.path ?? null, backendUrlTrimmed, auth.getAccessToken);
  const fileExplorer = useFileExplorer(workspace.workspace?.path ?? null);

  // ═══════════════════════════════════════════════════════════════════════════
  // UI STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [sidePanel, setSidePanel] = useState<SidePanel>("explorer");
  const [sidePanelVisible, setSidePanelVisible] = useState(true);
  const [chatPanelOpen, setChatPanelOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [viewingDiff, setViewingDiff] = useState<{ editId: string; filePath: string; original: string; modified: string } | null>(null);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [contextChips, setContextChips] = useState<ContextChip[]>([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key === "j" && !e.shiftKey) { e.preventDefault(); setTerminalOpen((p) => !p); }
      if (e.key === "b" && !e.shiftKey) { e.preventDefault(); setSidePanelVisible((p) => !p); }
      if (e.key === "p" && !e.shiftKey) { e.preventDefault(); setCommandPaletteOpen(true); }
      if (e.key === "p" && e.shiftKey) { e.preventDefault(); setCommandPaletteOpen(true); }
      if (e.key === "\\" && !e.shiftKey) { e.preventDefault(); setChatPanelOpen((p) => !p); }
      if (e.key === "e" && !e.shiftKey && !e.altKey) {
        // Cmd+E: focus explorer
        e.preventDefault();
        setSidePanel("explorer");
        setSidePanelVisible(true);
      }
      if (e.key === "s" && !e.shiftKey) {
        // Cmd+S: save active file
        if (fileExplorer.activeFile && fileExplorer.activeFile.content !== fileExplorer.activeFile.originalContent) {
          e.preventDefault();
          void fileExplorer.saveFile(fileExplorer.activeFile.path);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileExplorer.activeFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING EFFECTS (unchanged)
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
  }, [auth.auth?.accessToken, backendUrlTrimmed, backendReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const graphRunsLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!auth.auth?.accessToken || !models.selectedGraph) return;
    const key = `${backendUrlTrimmed}::${models.selectedGraph}`;
    if (graphRunsLoadedRef.current === key) return;
    graphRunsLoadedRef.current = key;
    void models.loadGraphRuns(models.selectedGraph);
  }, [auth.auth?.accessToken, models.selectedGraph, backendUrlTrimmed]); // eslint-disable-line react-hooks/exhaustive-deps

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
    graphRunsLoadedRef.current = null;
    conversationLoadedRef.current = null;
    threads.resetThreads();
    conversation.resetConversation();
    diffs.resetDiffs();
  }, [backendUrlTrimmed, workspace.workspace?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED STATE & MEMOS
  // ═══════════════════════════════════════════════════════════════════════════

  const activeThread = threads.threads.find((t) => t.id === threads.conversationId) ?? null;
  const activeThreadTitle = activeThread?.title || (threads.conversationId ? "Untitled" : "New thread");

  // Thread Items for the thread list
  const threadItems = useMemo(() => {
    return threads.threads.map((thread) => {
      const isEditing = threads.editingThreadId === thread.id;
      const isBusy = threads.threadActionId === thread.id;
      const meta = thread.updatedAt ? formatRelativeTime(thread.updatedAt) : "";
      const title = isEditing ? (
        <input value={threads.editingThreadTitle} onChange={(e) => threads.setEditingThreadTitle(e.target.value)} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="w-full rounded-md border border-border-subtle bg-bg-app px-2 py-1 text-xs text-text-primary" placeholder="Thread title" />
      ) : (<span className="truncate">{thread.title || "Untitled"}</span>);
      const actions = isEditing ? (
        <div className="flex items-center gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); void threads.saveEditedThreadTitle(); }} disabled={threads.editingThreadSaving} className="rounded-md border border-border-subtle bg-bg-elevated p-1 text-text-primary disabled:opacity-50"><Check className="h-3 w-3" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); threads.cancelEditThread(); }} className="rounded-md border border-border-subtle bg-bg-elevated p-1 text-text-secondary"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); threads.startEditThread(thread); }} disabled={isBusy} className="rounded-md border border-transparent p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:border-border-subtle hover:bg-bg-elevated disabled:opacity-40" title="Rename"><Pencil className="h-3 w-3" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); void threads.archiveThread(thread.id); }} disabled={isBusy} className="rounded-md border border-transparent p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:border-border-subtle hover:bg-bg-elevated disabled:opacity-40" title="Archive"><Archive className="h-3 w-3" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); void threads.deleteThread(thread.id); }} disabled={isBusy} className="rounded-md border border-transparent p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:border-border-subtle hover:bg-bg-elevated disabled:opacity-40" title="Delete"><Trash2 className="h-3 w-3" /></button>
        </div>
      );
      const threadStatus = thread.status === "archived" ? "archived" as const : threads.conversationId === thread.id ? "active" as const : "idle" as const;
      return { id: thread.id, title, meta, status: threadStatus, actions };
    });
  }, [threads.threads, threads.conversationId, threads.editingThreadId, threads.editingThreadTitle, threads.editingThreadSaving, threads.threadActionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editor tabs
  const editorTabs: EditorTab[] = useMemo(() => {
    const tabs: EditorTab[] = fileExplorer.openFiles.map((f) => ({
      id: f.path,
      filename: f.filename,
      filepath: f.path,
      isModified: f.content !== f.originalContent,
    }));
    if (viewingDiff) {
      tabs.push({
        id: `diff:${viewingDiff.editId}`,
        filename: `${viewingDiff.filePath.split("/").pop() ?? "diff"} (changes)`,
        filepath: viewingDiff.filePath,
        isModified: false,
      });
    }
    return tabs;
  }, [fileExplorer.openFiles, viewingDiff]);

  const activeTabId = viewingDiff ? `diff:${viewingDiff.editId}` : fileExplorer.activeFileId;

  // Activity bar items
  const activityItems: ActivityBarItem[] = useMemo(() => [
    { id: "explorer", icon: <Files className="w-5 h-5" />, label: "Explorer" },
    { id: "search", icon: <Search className="w-5 h-5" />, label: "Search" },
    { id: "git", icon: <GitBranch className="w-5 h-5" />, label: "Source Control", badge: git.totalChanges > 0 ? git.totalChanges : undefined },
    { id: "todo", icon: <ListTodo className="w-5 h-5" />, label: "Tasks", badge: todos.filter((t) => !t.done).length || undefined },
    { id: "chat", icon: <MessageSquare className="w-5 h-5" />, label: "Threads" },
  ], [git.totalChanges, todos]);

  const activityBottomItems: ActivityBarItem[] = useMemo(() => [
    { id: "settings", icon: <Settings className="w-5 h-5" />, label: "Settings" },
  ], []);

  // Command palette commands
  const commands: CommandItem[] = useMemo(() => [
    { id: "new-thread", label: "New Thread", category: "AI", shortcut: "⌘N", icon: <MessageSquare className="w-4 h-4 text-text-secondary" />, action: () => { conversation.abortRef.current?.abort(); conversation.resetConversation(); diffs.resetDiffs(); void threads.createConversation(models.selectedGraph, models.selectedGraphName); } },
    { id: "toggle-terminal", label: "Toggle Terminal", category: "View", shortcut: "⌘J", icon: <TerminalIcon className="w-4 h-4 text-text-secondary" />, action: () => setTerminalOpen((p) => !p) },
    { id: "toggle-sidebar", label: "Toggle Sidebar", category: "View", shortcut: "⌘B", action: () => setSidePanelVisible((p) => !p) },
    { id: "toggle-chat", label: "Toggle Chat Panel", category: "View", shortcut: "⌘\\", action: () => setChatPanelOpen((p) => !p) },
    { id: "open-settings", label: "Open Settings", category: "Preferences", shortcut: "⌘,", icon: <Settings className="w-4 h-4 text-text-secondary" />, action: () => settings.setActiveView("settings") },
    { id: "explorer", label: "Show Explorer", category: "View", shortcut: "⌘E", icon: <Files className="w-4 h-4 text-text-secondary" />, action: () => { setSidePanel("explorer"); setSidePanelVisible(true); } },
    { id: "show-search", label: "Search Files", category: "View", icon: <Search className="w-4 h-4 text-text-secondary" />, action: () => { setSidePanel("search"); setSidePanelVisible(true); } },
    { id: "show-git", label: "Source Control", category: "View", icon: <GitBranch className="w-4 h-4 text-text-secondary" />, action: () => { setSidePanel("git"); setSidePanelVisible(true); } },
    { id: "show-tasks", label: "Tasks / Planning", category: "View", icon: <ListTodo className="w-4 h-4 text-text-secondary" />, action: () => { setSidePanel("todo"); setSidePanelVisible(true); } },
    ...fileExplorer.openFiles.map((f) => ({
      id: `open:${f.path}`,
      label: f.filename,
      description: f.path,
      category: "Open Files",
      icon: <FileCode className="w-4 h-4 text-text-secondary" />,
      action: () => { setViewingDiff(null); fileExplorer.setActiveFileId(f.path); },
    })),
  ], [models.selectedGraph, models.selectedGraphName, fileExplorer.openFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Context chips: auto-attach active file
  useEffect(() => {
    if (fileExplorer.activeFile && !contextChips.find((c) => c.id === fileExplorer.activeFile!.path)) {
      setContextChips((prev) => [
        ...prev.filter((c) => c.variant !== "file"),
        createFileChip(fileExplorer.activeFile!.filename, fileExplorer.activeFile!.path),
      ]);
    }
  }, [fileExplorer.activeFileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  function handleActivityClick(item: ActivityBarItem) {
    if (item.id === "settings") {
      settings.setActiveView("settings");
      return;
    }
    const panel = item.id as SidePanel;
    if (sidePanel === panel && sidePanelVisible) {
      setSidePanelVisible(false);
    } else {
      setSidePanel(panel);
      setSidePanelVisible(true);
    }
  }

  function handleTabSelect(tab: EditorTab) {
    if (tab.id.startsWith("diff:")) {
      const editId = tab.id.replace("diff:", "");
      const d = diffs.diffs.find((df) => df.editId === editId);
      if (d) setViewingDiff({ editId: d.editId, filePath: d.filePath, original: d.baseContent, modified: d.targetContent });
    } else {
      setViewingDiff(null);
      fileExplorer.setActiveFileId(tab.id);
    }
  }

  function handleTabClose(tab: EditorTab) {
    if (tab.id.startsWith("diff:")) {
      setViewingDiff(null);
    } else {
      fileExplorer.closeFile(tab.id);
    }
  }

  function openDiffInEditor(editId: string) {
    const d = diffs.diffs.find((df) => df.editId === editId);
    if (d) setViewingDiff({ editId: d.editId, filePath: d.filePath, original: d.baseContent, modified: d.targetContent });
  }

  function handleTodoAdd(text: string) {
    setTodos((p) => [...p, { id: crypto.randomUUID(), text, done: false, source: "user" }]);
  }
  function handleTodoToggle(id: string) {
    setTodos((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }
  function handleTodoRemove(id: string) {
    setTodos((p) => p.filter((t) => t.id !== id));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (settings.activeView === "settings") {
    return (
      <div className="flex h-screen flex-col bg-bg-app text-text-primary">
        <header className="flex h-10 items-center border-b border-border-subtle bg-bg-surface/80 px-4 app-region-drag">
          <TrafficLights />
          <span className="ml-4 text-xs font-medium text-text-secondary">Settings</span>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <aside className="flex w-60 flex-col border-r border-border-subtle bg-bg-app px-2 py-3">
            <button type="button" onClick={() => settings.setActiveView("app")} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"><ChevronLeft className="h-3.5 w-3.5" /> Back to app</button>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Settings</div>
            <div className="mt-2 flex flex-col gap-1">
              {SETTINGS_SECTIONS.map((section) => (
                <button key={section.id} type="button" onClick={() => settings.setActiveSettingsSection(section.id)} className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs font-medium transition ${settings.activeSettingsSection === section.id ? "bg-state-selected text-text-primary" : "text-text-secondary hover:bg-state-hover hover:text-text-primary"}`}>{section.label}</button>
              ))}
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto px-6 py-4 scrollbar-elegant">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {(settings.activeSettingsSection === "configuration" || settings.activeSettingsSection === "general") && (
                <>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Backend</h2>
                    <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle rounded-md">
                      <div className="flex items-center justify-between gap-4 px-3 py-2"><div><div className="text-sm font-medium text-text-primary">Backend URL</div><div className="text-xs text-text-muted">Connect to your Numezis backend.</div></div><input value={settings.backendUrl} onChange={(e) => settings.setBackendUrl(e.target.value)} className="w-56 rounded-md border border-border-subtle bg-bg-app px-2 py-1 text-xs text-text-primary" placeholder="https://app.numezis.com" /></div>
                      <div className="flex items-center justify-between gap-4 px-3 py-2"><div className="text-sm font-medium text-text-primary">Connection status</div><span className={`flex items-center gap-1.5 text-xs ${backendReady ? "text-status-success-text" : "text-status-error-text"}`}><span className={`h-1.5 w-1.5 rounded-full ${backendReady ? "bg-status-success" : "bg-status-error"}`} />{backendReady ? "Connected" : "Disconnected"}</span></div>
                      <div className="flex items-center justify-between gap-4 px-3 py-2"><div><div className="text-sm font-medium text-text-primary">Account</div><div className="text-xs text-text-muted">{auth.auth?.user?.email || "Sign in to access threads and runs."}</div></div><div className="flex items-center gap-2">{auth.auth?.accessToken ? (<Button size="xs" variant="secondary" onClick={auth.signOut}>Sign out</Button>) : (<><Button size="xs" variant="secondary" onClick={auth.startWebLogin} disabled={!backendUrlValid || auth.loginPending}>{auth.loginPending ? "Signing in..." : "Sign in"}</Button><Button size="xs" variant="ghost" onClick={auth.startWebRegister} disabled={!backendUrlValid || auth.loginPending}>Create account</Button></>)}</div></div>
                      {auth.loginError && <div className="px-3 py-2 text-xs text-status-error-text">{auth.loginError}</div>}
                    </div>
                  </section>
                  <section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">Models</h2><LLMSelector providers={models.providers} selectedProvider={models.selectedProvider} selectedModel={models.selectedModel} onProviderChange={models.changeProvider} onModelChange={models.setSelectedModel} /></section>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-primary">Agent graphs</h2>
                    <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle rounded-md">
                      {models.graphsLoading && <div className="px-3 py-2 text-xs text-text-muted">Loading graphs...</div>}
                      {models.graphsError && <div className="px-3 py-2 text-xs text-status-error-text">{models.graphsError}</div>}
                      {!models.graphsLoading && !models.graphsError && models.graphs.length === 0 && <div className="px-3 py-2 text-xs text-text-muted">No graphs available.</div>}
                      {models.graphs.map((graph) => (<button key={graph.id} type="button" onClick={() => models.setSelectedGraph(graph.id)} className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-xs ${models.selectedGraph === graph.id ? "bg-state-selected text-text-primary" : "text-text-secondary hover:bg-state-hover"}`}><div className="min-w-0"><div className="truncate text-sm font-medium text-text-primary">{graph.name}</div><div className="text-[11px] text-text-muted">{graph.description ?? graph.id}</div></div><span className="text-[10px] text-text-muted">{formatRelativeTime(graph.updatedAt)}</span></button>))}
                    </div>
                  </section>
                  <section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">Tools</h2><div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle rounded-md">{models.toolsLoading && <div className="px-3 py-2 text-xs text-text-muted">Loading tools...</div>}{!models.toolsLoading && models.tools.length === 0 && <div className="px-3 py-2 text-xs text-text-muted">No tools available.</div>}{models.tools.map((tool) => (<div key={tool.name} className="px-3 py-2 text-xs text-text-secondary"><div className="text-sm font-medium text-text-primary">{tool.name}</div><div className="text-[11px] text-text-muted">{tool.description ?? "No description"}</div></div>))}</div></section>
                </>
              )}
              {settings.activeSettingsSection === "general" && (
                <section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">General</h2><div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle rounded-md"><div className="flex items-center justify-between gap-4 px-3 py-2"><div><div className="text-sm font-medium text-text-primary">Prevent sleep while running</div><div className="text-xs text-text-muted">Keep your computer awake while the agent runs.</div></div><Toggle size="sm" checked={settings.settingsToggles.preventSleep} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, preventSleep: c }))} /></div><div className="flex items-center justify-between gap-4 px-3 py-2"><div><div className="text-sm font-medium text-text-primary">Require ⌘+Enter to send</div><div className="text-xs text-text-muted">Multiline prompts require ⌘+Enter to send.</div></div><Toggle size="sm" checked={settings.settingsToggles.requireCmdEnter} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, requireCmdEnter: c }))} /></div></div></section>
              )}
              {settings.activeSettingsSection === "personalization" && (<section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">Appearance</h2><div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle rounded-md"><div className="flex items-center justify-between gap-4 px-3 py-2"><div><div className="text-sm font-medium text-text-primary">Compact density</div><div className="text-xs text-text-muted">Reduce padding across the interface.</div></div><Toggle size="sm" checked={settings.settingsToggles.compactDensity} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, compactDensity: c }))} /></div><div className="flex items-center justify-between gap-4 px-3 py-2"><div><div className="text-sm font-medium text-text-primary">Opaque background</div><div className="text-xs text-text-muted">Reduce translucency for focus.</div></div><Toggle size="sm" checked={settings.settingsToggles.opaqueBackground} onChange={(c) => settings.setSettingsToggles((p) => ({ ...p, opaqueBackground: c }))} /></div></div></section>)}
              {settings.activeSettingsSection === "mcp" && (<section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">MCP Servers</h2><MCPServerConfig servers={mcpServers} onAdd={(s) => setMcpServers((p) => [...p, { ...s, id: crypto.randomUUID(), enabled: true, status: "disconnected" }])} onRemove={(id) => setMcpServers((p) => p.filter((s) => s.id !== id))} onToggle={(id, enabled) => setMcpServers((p) => p.map((s) => (s.id === id ? { ...s, enabled } : s)))} /></section>)}
              {settings.activeSettingsSection === "git" && (<section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">Git</h2><div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle rounded-md"><div className="flex items-center justify-between gap-4 px-3 py-2"><div className="text-sm font-medium text-text-primary">Current branch</div><span className="text-xs text-text-muted">{git.gitStatus?.branch ?? "N/A"}</span></div><div className="flex items-center justify-between gap-4 px-3 py-2"><div className="text-sm font-medium text-text-primary">Changes</div><span className="text-xs text-text-muted">{git.totalChanges} file(s)</span></div></div></section>)}
              {settings.activeSettingsSection === "environments" && (<section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">Environment Variables</h2><EnvironmentConfig variables={envVariables} onAdd={(v) => setEnvVariables((p) => [...p, v])} onRemove={(key) => setEnvVariables((p) => p.filter((v) => v.key !== key))} onEdit={(key, value) => setEnvVariables((p) => p.map((v) => (v.key === key ? { ...v, value } : v)))} /></section>)}
              {settings.activeSettingsSection === "worktrees" && (<section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">Worktrees</h2><WorktreeManager worktrees={worktrees} activeWorktree={workspace.workspace?.path} onAdd={(path, branch) => setWorktrees((p) => [...p, { path, branch, isMain: false }])} onRemove={(path) => setWorktrees((p) => p.filter((w) => w.path !== path))} onSwitch={(path) => workspace.setWorkspace({ path, name: path.split("/").pop() || path })} /></section>)}
              {settings.activeSettingsSection === "archived" && (<section className="space-y-3"><h2 className="text-sm font-semibold text-text-primary">Archived Threads</h2><div className="border border-border-subtle bg-bg-surface px-3 py-4 text-xs text-text-muted text-center rounded-md">Archived threads can be viewed and restored from the web portal.</div></section>)}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN IDE VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen flex-col bg-bg-app text-text-primary">
      {/* ── Title Bar ── */}
      <header className="flex h-10 items-center justify-between border-b border-border-subtle bg-bg-surface/80 px-4 app-region-drag">
        <div className="flex items-center gap-3">
          <TrafficLights className="app-region-no-drag" />
          <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            {workspace.workspace?.name || "Numezis Desktop"}
          </div>
        </div>
        <div className="flex items-center gap-2 app-region-no-drag">
          <button type="button" onClick={() => setCommandPaletteOpen(true)} className="rounded-md border border-border-subtle bg-bg-app px-3 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors flex items-center gap-2" title="Command Palette (⌘P)">
            <Search className="h-3 w-3" /> <span>Search…</span> <kbd className="text-[9px] ml-1 opacity-60">⌘P</kbd>
          </button>
          <Button
            size="xs"
            disabled={!backendReady || !auth.auth?.accessToken}
            onClick={() => {
              conversation.abortRef.current?.abort();
              conversation.resetConversation();
              diffs.resetDiffs();
              void threads.createConversation(models.selectedGraph, models.selectedGraphName);
            }}
          >
            New thread
          </Button>
        </div>
      </header>

      {/* ── Main Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Activity Bar */}
        <ActivityBar
          items={activityItems}
          activeItemId={sidePanelVisible ? sidePanel : undefined}
          onItemClick={handleActivityClick}
          bottomItems={activityBottomItems}
        />

        {/* Primary Sidebar */}
        {sidePanelVisible && (
          <div className="w-[260px] flex-shrink-0 border-r border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {sidePanel === "explorer" ? "Explorer" : sidePanel === "search" ? "Search" : sidePanel === "git" ? "Source Control" : sidePanel === "todo" ? "Tasks" : "Threads"}
              </span>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {sidePanel === "explorer" && (
                <FileBrowser
                  files={fileExplorer.files}
                  selectedPath={fileExplorer.selectedPath}
                  expandedPaths={fileExplorer.expandedPaths}
                  onFileSelect={(path) => fileExplorer.setSelectedPath(path)}
                  onFileOpen={(path) => { setViewingDiff(null); void fileExplorer.openFile(path); }}
                  onDirectoryToggle={(path) => void fileExplorer.toggleDirectory(path)}
                  onCollapseAll={fileExplorer.collapseAll}
                  onRefresh={fileExplorer.refreshFiles}
                  loading={fileExplorer.loading}
                />
              )}
              {sidePanel === "search" && (
                <SearchPanel files={fileExplorer.files} onFileOpen={(path) => { setViewingDiff(null); void fileExplorer.openFile(path); }} />
              )}
              {sidePanel === "git" && (
                <GitPanel
                  status={git.gitStatus}
                  branches={git.branches}
                  loading={git.gitLoading}
                  commitMessage={git.commitMessage}
                  onCommitMessageChange={git.setCommitMessage}
                  onCommit={git.commit}
                  onBranchSwitch={git.switchBranch}
                  onBranchCreate={git.createBranch}
                  onRefresh={git.refreshStatus}
                  onGenerateMessage={git.generateCommitMessage}
                  committing={git.committing}
                  generatingMessage={git.generatingMessage}
                  onFileClick={(path) => { setViewingDiff(null); void fileExplorer.openFile(path); }}
                />
              )}
              {sidePanel === "todo" && (
                <TodoPanel items={todos} onAdd={handleTodoAdd} onToggle={handleTodoToggle} onRemove={handleTodoRemove} />
              )}
              {sidePanel === "chat" && (
                <ThreadFeed
                  title="Threads"
                  items={threadItems}
                  activeId={threads.conversationId ?? undefined}
                  onSelect={(id) => {
                    if (id === threads.conversationId) return;
                    conversation.abortRef.current?.abort();
                    conversation.resetConversation();
                    diffs.resetDiffs();
                    threads.setConversationId(id);
                  }}
                  emptyState={
                    !auth.auth?.accessToken
                      ? <span className="text-text-muted">Sign in to load threads.</span>
                      : threads.threadsLoading
                        ? <span className="text-text-muted">Loading...</span>
                        : <span className="text-text-muted">No threads yet.</span>
                  }
                  showCount
                />
              )}
            </div>
          </div>
        )}

        {/* ── Editor Area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor Tabs */}
          {editorTabs.length > 0 && (
            <EditorTabs
              tabs={editorTabs}
              activeTabId={activeTabId ?? undefined}
              onTabSelect={handleTabSelect}
              onTabClose={handleTabClose}
            />
          )}

          {/* Editor Content */}
          <div className="flex-1 min-h-0">
            {viewingDiff ? (
              <DiffEditor
                original={viewingDiff.original}
                modified={viewingDiff.modified}
                filename={viewingDiff.filePath}
                onAccept={() => { diffs.applyAllDiff(viewingDiff.editId); setViewingDiff(null); }}
                onReject={() => { diffs.rejectAllDiff(viewingDiff.editId); setViewingDiff(null); }}
              />
            ) : fileExplorer.activeFile ? (
              fileExplorer.activeFile.language === "binary" ? (
                <div className="flex h-full items-center justify-center text-xs text-text-muted">Binary file — cannot be displayed in the editor.</div>
              ) : (
                <CodeEditor
                  value={fileExplorer.activeFile.content}
                  filename={fileExplorer.activeFile.filename}
                  onChange={(value) => fileExplorer.updateFileContent(fileExplorer.activeFile!.path, value)}
                  onSave={(value) => {
                    fileExplorer.updateFileContent(fileExplorer.activeFile!.path, value);
                    void fileExplorer.saveFile(fileExplorer.activeFile!.path);
                  }}
                  minimap={false}
                />
              )
            ) : (
              /* Welcome Screen */
              <div className="flex h-full flex-col items-center justify-center gap-4 text-text-muted">
                <Brain className="w-10 h-10 opacity-30" />
                <div className="text-center">
                  <div className="text-sm font-medium text-text-secondary">Numezis Desktop</div>
                  <div className="text-xs mt-1">Open a file from the explorer or start a conversation</div>
                </div>
                <div className="flex flex-col gap-1 text-[11px] mt-2">
                  <span><kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px]">⌘P</kbd> Command Palette</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px]">⌘B</kbd> Toggle Sidebar</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px]">⌘J</kbd> Toggle Terminal</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px]">⌘\</kbd> Toggle Chat</span>
                </div>
              </div>
            )}
          </div>

          {/* Terminal */}
          {terminalOpen && (
            <div className="h-48 border-t border-border-subtle bg-bg-surface flex flex-col">
              <div className="flex items-center justify-between px-3 py-1 border-b border-border-subtle">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Terminal</span>
                <button type="button" onClick={() => setTerminalOpen(false)} className="p-0.5 text-text-muted hover:text-text-primary"><X className="w-3 h-3" /></button>
              </div>
              <div className="flex-1 min-h-0">
                <Terminal />
              </div>
            </div>
          )}
        </div>

        {/* ── Chat Panel (Right) ── */}
        {chatPanelOpen && (
          <div className="w-[380px] flex-shrink-0 border-l border-border-subtle bg-bg-app flex flex-col">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
              <div className="flex items-center gap-2 min-w-0">
                <Brain className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-xs font-medium text-text-primary truncate">{activeThreadTitle}</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { setSidePanel("chat"); setSidePanelVisible(true); }} className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors" title="Show all threads">
                  <MessageSquare className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setChatPanelOpen(false)} className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors" title="Close chat (⌘\\)">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-elegant">
              {threads.conversationId && (
                <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs">
                  <div className="text-sm font-semibold text-text-primary">{activeThreadTitle}</div>
                  <div className="text-[10px] text-text-muted">Updated {activeThread?.updatedAt ? formatRelativeTime(activeThread.updatedAt) : "now"}</div>
                </div>
              )}

              {conversation.conversationLoading && (
                <div className="border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted rounded-md">Loading thread...</div>
              )}

              <div className="space-y-3">
                {conversation.renderItems.map((item, idx) => {
                  if (item.type === "tools") {
                    const pairs: { call?: typeof item.events[0]; result?: typeof item.events[0] }[] = [];
                    let current: { call?: typeof item.events[0]; result?: typeof item.events[0] } = {};
                    for (const e of item.events) {
                      if (e.kind === "assistant" && e.toolName) { if (current.call) pairs.push(current); current = { call: e }; }
                      else if (e.kind === "tool") { current.result = e; pairs.push(current); current = {}; }
                    }
                    if (current.call) pairs.push(current);
                    return (
                      <div key={`tools-${idx}`}>
                        {pairs.map((pair, i) => (
                          <ToolInvocation key={`tools-${idx}-${i}`} name={pair.call?.toolName ?? pair.result?.toolName ?? "tool"} args={pair.call?.toolArgs} output={pair.result?.toolOutput} />
                        ))}
                      </div>
                    );
                  }

                  const event = item.event;
                  const isUser = event.kind === "user";
                  const isAssistant = event.kind === "assistant" && !event.toolName;
                  const isSystem = event.kind === "system";

                  if (isSystem) return <div key={`${event.id ?? idx}-sys`} className="px-1 py-1 text-[10px] text-text-muted">{event.content}</div>;
                  if (!isUser && !isAssistant) return null;

                  const isEditing = typeof event.messageIndex === "number" && event.messageIndex === conversation.editingMessageIndex;

                  return (
                    <div key={`${event.id ?? idx}-msg`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`group max-w-[95%] rounded-lg px-3 py-2 text-[12px] ${isUser ? "border border-border-subtle bg-bg-elevated text-text-primary" : "bg-transparent text-text-secondary"}`}>
                        {threads.conversationId && !conversation.streaming && typeof event.messageIndex === "number" && (
                          <div className="flex justify-end mb-1">
                            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                              {isEditing ? (
                                <>
                                  <Button size="xs" variant="ghost" onClick={conversation.saveEditedMessage} disabled={conversation.editingMessageSaving}><Check className="h-3 w-3" /></Button>
                                  <Button size="xs" variant="ghost" onClick={conversation.cancelEditMessage}><X className="h-3 w-3" /></Button>
                                </>
                              ) : (
                                <Button size="xs" variant="ghost" onClick={() => conversation.startEditMessage(event.messageIndex!, event.content || "")}><Pencil className="h-3 w-3" /></Button>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="min-w-0 leading-relaxed">
                          {isEditing ? (
                            <Textarea value={conversation.editingMessageDraft} onChange={(e) => conversation.setEditingMessageDraft(e.target.value)} disabled={conversation.editingMessageSaving} noResize />
                          ) : isAssistant ? (
                            <MarkdownRenderer content={event.content ?? ""} />
                          ) : (
                            event.content
                          )}
                        </div>
                        {isEditing && conversation.editingMessageError && <div className="mt-1 text-[10px] text-status-error-text">{conversation.editingMessageError}</div>}
                      </div>
                    </div>
                  );
                })}

                {/* Thinking indicator */}
                {conversation.streaming && !conversation.streamHasEvents && (
                  <ThinkingBubble isActive summary="Working on it…" />
                )}
                {conversation.streaming && conversation.streamHasEvents && (
                  <ThinkingBubble isActive summary="Agent is running…" />
                )}

                {conversation.sendError && <div className="border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-text rounded-md">{conversation.sendError}</div>}
                <div ref={conversation.messagesEndRef} />
              </div>
            </div>

            {/* Pending Changes (from agent) */}
            {diffs.diffs.length > 0 && (
              <div className="border-t border-border-subtle">
                <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  <span>Pending changes</span>
                  <span>{diffs.diffs.length}</span>
                </div>
                <div className="max-h-32 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-elegant">
                  {diffs.diffs.map((diff) => (
                    <div key={diff.editId} className="flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs hover:bg-state-hover transition-colors">
                      <button type="button" onClick={() => openDiffInEditor(diff.editId)} className="flex-1 text-left truncate text-text-secondary hover:text-text-primary">{diff.filePath}</button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="xs" variant="secondary" onClick={() => diffs.applyAllDiff(diff.editId)}>Accept</Button>
                        <Button size="xs" variant="ghost" onClick={() => diffs.rejectAllDiff(diff.editId)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Context Chips */}
            {contextChips.length > 0 && (
              <div className="px-3 pt-2">
                <ContextChips chips={contextChips} onDismiss={(id) => setContextChips((p) => p.filter((c) => c.id !== id))} size="sm" />
              </div>
            )}

            {/* Chat Input */}
            <div className="border-t border-border-subtle p-3">
              <ChatInput
                value={conversation.input}
                onChange={conversation.setInput}
                onSend={conversation.sendMessage}
                onStop={conversation.stopStreaming}
                sending={conversation.streaming}
                disabled={conversation.streaming || !backendReady || !auth.auth?.accessToken}
                placeholder="Ask for follow-up changes"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void conversation.sendMessage(); } }}
                footerLeft={
                  <Button variant="secondary" size="xs" onClick={() => setTerminalOpen((p) => !p)} className="flex items-center gap-2">
                    <TerminalIcon className="h-3.5 w-3.5" />
                    Terminal
                  </Button>
                }
                footerRight={
                  <div className="flex items-center gap-2">
                    <LLMSelector providers={models.providers} selectedProvider={models.selectedProvider} selectedModel={models.selectedModel} onProviderChange={models.changeProvider} onModelChange={models.setSelectedModel} compact />
                    <span className={`h-1.5 w-1.5 rounded-full ${backendConnected ? "bg-status-success" : "bg-status-error"}`} title={backendConnected ? "Connected" : "Disconnected"} />
                  </div>
                }
              />
              {conversation.tokenUsage && (
                <div className="mt-1 text-[10px] text-text-muted font-mono">
                  Token usage: {conversation.tokenUsage.input ?? "—"} input · {conversation.tokenUsage.output ?? "—"} output
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Status Bar ── */}
      <StatusBar
        branch={git.gitStatus?.branch}
        syncStatus={git.gitLoading ? "syncing" : "synced"}
        problems={git.gitError ? { errors: 1, warnings: 0 } : undefined}
        language={fileExplorer.activeFile?.language}
        encoding="UTF-8"
        lineInfo={fileExplorer.activeFile ? `${fileExplorer.activeFile.filename}` : undefined}
      />

      {/* ── Command Palette ── */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
        placeholder="Type a command or search files…"
      />
    </div>
  );
}
