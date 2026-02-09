"use client";

import { useMemo, useState } from "react";
import {
    Archive, Check, Pencil, Terminal as TerminalIcon, Trash2,
    Files, Search, GitBranch, Brain, ListTodo, MessageSquare,
    Settings, X, FileCode, Plus,
} from "lucide-react";

import {
    Button,
    ChatInput,
    ThreadFeed,
    SettingsPanel,
    Switch,
    WorkspaceLayout,
    MessageBubble,
    SystemMessage,
    ToolInvocation,
    ActivityBar,
    FileBrowser,
    EditorTabs,
    CommandPalette,
    StatusBar,
    GitPanel,
    ContextChips,
    createFileChip,
    createFolderChip,
    createModelChip,
    ThinkingBubble,
    AgentTaskQueue,
} from "@numezis/ui/components/design-system";
import type { ActivityBarItem, CommandItem, ContextChip, AgentTask } from "@numezis/ui/components/design-system";

import { DocCard, DocCode, DocRules, DocSection } from "../../components/DocBlocks";
import { InspectButton } from "../../components/Inspector";
import { componentDocs } from "../../docs";

type SampleEvent = {
    id: string;
    kind: "user" | "assistant" | "tool" | "system";
    label: string;
    meta: string;
    content?: string;
    toolName?: string;
    toolArgs?: string;
    toolOutput?: string;
};

type RenderItem =
    | { type: "event"; event: SampleEvent }
    | { type: "tools"; events: SampleEvent[] };

type DiffPreviewRow = {
    type: "context" | "add" | "remove";
    left?: { num: number; text: string };
    right?: { num: number; text: string };
};

const sampleThreads = [
    { id: "thread-1", title: "Agent Session", status: "active" as const, meta: "now" },
    { id: "thread-2", title: "Explore Session", status: "waiting" as const, meta: "6m" },
    { id: "thread-3", title: "Design update", status: "idle" as const, meta: "18m" },
    { id: "thread-4", title: "Audit notes", status: "idle" as const, meta: "1h" },
];

const sampleEvents: SampleEvent[] = [
    {
        id: "evt-1",
        kind: "user",
        label: "",
        meta: "",
        content: "Add a file explorer to the sidebar with directory expansion",
    },
    {
        id: "evt-2",
        kind: "assistant",
        label: "",
        meta: "",
        content: "I'll add a file browser component. Let me check the current sidebar implementation first.",
    },
    // ── read_file ──
    {
        id: "evt-3",
        kind: "assistant",
        label: "",
        meta: "180ms",
        toolName: "read_file",
        toolArgs: "{\n  \"path\": \"src/components/Sidebar.tsx\"\n}",
    },
    {
        id: "evt-4",
        kind: "tool",
        label: "",
        meta: "240ms",
        toolName: "read_file",
        toolOutput: "import React from 'react';\n\nexport function Sidebar({ files, selectedFile, onFileSelect }) {\n  return (\n    <aside className=\"w-64 border-r border-border-subtle bg-bg-surface\">\n      <div className=\"p-3 text-sm text-text-muted\">No files loaded</div>\n    </aside>\n  );\n}",
    },
    // ── grep_search ──
    {
        id: "evt-5",
        kind: "assistant",
        label: "",
        meta: "120ms",
        toolName: "grep_search",
        toolArgs: "{\n  \"query\": \"FileBrowser\",\n  \"path\": \"src/\"\n}",
    },
    {
        id: "evt-6",
        kind: "tool",
        label: "",
        meta: "85ms",
        toolName: "grep_search",
        toolOutput: "src/components/ui/FileBrowser.tsx:1:export function FileBrowser\nsrc/components/ui/index.ts:12:export { FileBrowser } from './FileBrowser'\nsrc/app/App.tsx:4:import { FileBrowser } from '../components/ui'",
    },
    // ── edit_file ──
    {
        id: "evt-7",
        kind: "assistant",
        label: "",
        meta: "340ms",
        toolName: "edit_file",
        toolArgs: "{\n  \"path\": \"src/components/Sidebar.tsx\",\n  \"old_string\": \"<div className=\\\"p-3 text-sm\\\">No files loaded</div>\",\n  \"new_string\": \"<FileBrowser\\n  files={files}\\n  selectedPath={selectedFile}\\n  onFileSelect={onFileSelect}\\n/>\"\n}",
    },
    {
        id: "evt-8",
        kind: "tool",
        label: "",
        meta: "12ms",
        toolName: "edit_file",
        toolOutput: "Applied edit to src/components/Sidebar.tsx",
    },
    // ── run_command ──
    {
        id: "evt-9",
        kind: "assistant",
        label: "",
        meta: "1.2s",
        toolName: "run_command",
        toolArgs: "{\n  \"command\": \"npx tsc --noEmit\"\n}",
    },
    {
        id: "evt-10",
        kind: "tool",
        label: "",
        meta: "3.4s",
        toolName: "run_command",
        toolOutput: "$ npx tsc --noEmit\n\nNo errors found.\n\nExit code: 0",
    },
    // ── final message ──
    {
        id: "evt-11",
        kind: "assistant",
        label: "",
        meta: "",
        content: "Done. The sidebar now renders a FileBrowser with directory expansion. TypeScript compiles with zero errors.",
    },
];

const sampleDiffs = [
    { id: "diff-1", path: "apps/desktop/src/app/App.tsx", hunks: 3 },
    { id: "diff-2", path: "apps/web/app/design-system/(tabs)/mac-app/page.tsx", hunks: 1 },
];

const sampleHunks = [
    { id: "hunk-1", label: "Change 1", meta: "+12 / -3" },
    { id: "hunk-2", label: "Change 2", meta: "+4 / -1" },
    { id: "hunk-3", label: "Change 3", meta: "+6 / -2" },
];

const sampleDiffPreviewRows: DiffPreviewRow[] = [
    { type: "remove", left: { num: 12, text: "const tools = await fetchTools();" } },
    { type: "add", right: { num: 12, text: "const tools = await fetchTools({" } },
    { type: "add", right: { num: 13, text: "  includeDescriptions: true" } },
    { type: "add", right: { num: 14, text: "});" } },
    { type: "context", left: { num: 15, text: "setTools(tools);" }, right: { num: 15, text: "setTools(tools);" } },
    { type: "context", left: { num: 16, text: "setToolsLoading(false);" }, right: { num: 16, text: "setToolsLoading(false);" } },
];

const MAX_TOOL_PREVIEW_CHARS = 160;

function formatMaybeJson(value?: string) {
    if (!value) return "";
    try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return value;
    }
}

function formatToolPreview(value?: string) {
    if (!value) return "";
    const formatted = formatMaybeJson(value).replace(/\s+/g, " ").trim();
    if (!formatted) return "";
    if (formatted.length <= MAX_TOOL_PREVIEW_CHARS) return formatted;
    return `${formatted.slice(0, MAX_TOOL_PREVIEW_CHARS)}…`;
}

// ── Sample data for new IDE components ──

const sampleFiles = [
    { path: "src", name: "src", isDirectory: true },
    { path: "src/app", name: "app", isDirectory: true },
    { path: "src/app/App.tsx", name: "App.tsx", isDirectory: false },
    { path: "src/app/styles.css", name: "styles.css", isDirectory: false },
    { path: "src/hooks", name: "hooks", isDirectory: true },
    { path: "src/hooks/useAuth.ts", name: "useAuth.ts", isDirectory: false },
    { path: "src/hooks/useGit.ts", name: "useGit.ts", isDirectory: false },
    { path: "src/utils.ts", name: "utils.ts", isDirectory: false },
    { path: "package.json", name: "package.json", isDirectory: false },
    { path: "tsconfig.json", name: "tsconfig.json", isDirectory: false },
];

const sampleEditorTabs = [
    { id: "App.tsx", filename: "App.tsx", filepath: "src/app/App.tsx", isModified: true },
    { id: "useAuth.ts", filename: "useAuth.ts", filepath: "src/hooks/useAuth.ts" },
    { id: "utils.ts", filename: "utils.ts", filepath: "src/utils.ts" },
];

const sampleGitStatus = {
    branch: "feat/ide-layout",
    ahead: 2,
    behind: 0,
    modified: ["src/app/App.tsx", "src/hooks/useGit.ts"],
    created: ["src/app/panels/SearchPanel.tsx", "src/app/panels/TodoPanel.tsx"],
    deleted: [],
    renamed: [],
};

const sampleContextChips: ContextChip[] = [
    createFileChip("App.tsx", "chip-1"),
    createFolderChip("src/hooks", "chip-2"),
    createModelChip("claude-4", "chip-3"),
];

export default function DesignSystemMacAppPage() {
    const [activeThreadId, setActiveThreadId] = useState("thread-1");
    const [draft, setDraft] = useState("");
    const [sendingDraft, setSendingDraft] = useState("Generating follow-up changes...");
    const [sendingActive, setSendingActive] = useState(true);
    const [activeSidePanel, setActiveSidePanel] = useState("explorer");
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [gitCommitMessage, setGitCommitMessage] = useState("");
    const [contextChips, setContextChips] = useState<ContextChip[]>(sampleContextChips);
    const [settingsState, setSettingsState] = useState({
        autoApprove: true,
        streaming: true,
        compactUI: false,
    });

    // ── Agent Task Queue (mirrors state.taskQueue from agent graph runs) ──
    const [taskQueue, setTaskQueue] = useState<AgentTask[]>([
        { id: "task-1", title: "Analyze existing Sidebar component", status: "done", file: "src/components/Sidebar.tsx" },
        { id: "task-2", title: "Add FileBrowser to sidebar panel", status: "done", file: "src/components/Sidebar.tsx" },
        { id: "task-3", title: "Integrate CodeEditor with file open", status: "in_progress", file: "src/app/App.tsx" },
        { id: "task-4", title: "Add git commit flow to GitPanel", status: "todo", file: "src/components/GitPanel.tsx" },
        { id: "task-5", title: "Wire up keyboard shortcuts", status: "todo" },
    ]);

    const pendingTaskCount = useMemo(
        () => taskQueue.filter(t => t.status === "todo" || t.status === "in_progress").length,
        [taskQueue]
    );

    const activityItems: ActivityBarItem[] = useMemo(() => [
        { id: "explorer", icon: <Files className="w-5 h-5" />, label: "Explorer" },
        { id: "search", icon: <Search className="w-5 h-5" />, label: "Search" },
        { id: "git", icon: <GitBranch className="w-5 h-5" />, label: "Source Control", badge: 4 },
        { id: "todo", icon: <ListTodo className="w-5 h-5" />, label: "Tasks", badge: pendingTaskCount || undefined },
        { id: "chat", icon: <MessageSquare className="w-5 h-5" />, label: "Threads" },
    ], [pendingTaskCount]);

    const sampleCommands: CommandItem[] = useMemo(() => [
        { id: "new-thread", label: "New Thread", category: "AI", shortcut: "⌘N", icon: <MessageSquare className="w-4 h-4 text-text-secondary" /> },
        { id: "toggle-terminal", label: "Toggle Terminal", category: "View", shortcut: "⌘J", icon: <TerminalIcon className="w-4 h-4 text-text-secondary" /> },
        { id: "toggle-sidebar", label: "Toggle Sidebar", category: "View", shortcut: "⌘B" },
        { id: "toggle-chat", label: "Toggle Chat Panel", category: "View", shortcut: "⌘\\" },
        { id: "open-settings", label: "Open Settings", category: "Preferences", shortcut: "⌘,", icon: <Settings className="w-4 h-4 text-text-secondary" /> },
        { id: "explorer", label: "Show Explorer", category: "View", shortcut: "⌘E", icon: <Files className="w-4 h-4 text-text-secondary" /> },
        { id: "search", label: "Search Files", category: "View", icon: <Search className="w-4 h-4 text-text-secondary" /> },
        { id: "git", label: "Source Control", category: "View", icon: <GitBranch className="w-4 h-4 text-text-secondary" /> },
    ], []);

    const settingsItems = [
        {
            id: "auto-approve",
            label: "Auto-approve safe edits",
            description: "Skip confirmations for low-risk changes.",
            control: (
                <Switch
                    size="sm"
                    checked={settingsState.autoApprove}
                    onChange={(checked) => setSettingsState((prev) => ({ ...prev, autoApprove: checked }))}
                />
            ),
        },
        {
            id: "streaming",
            label: "Live streaming",
            description: "Stream output tokens as they arrive.",
            control: (
                <Switch
                    size="sm"
                    checked={settingsState.streaming}
                    onChange={(checked) => setSettingsState((prev) => ({ ...prev, streaming: checked }))}
                />
            ),
        },
        {
            id: "compact-ui",
            label: "Compact density",
            description: "Reduce padding across panels.",
            control: (
                <Switch
                    size="sm"
                    checked={settingsState.compactUI}
                    onChange={(checked) => setSettingsState((prev) => ({ ...prev, compactUI: checked }))}
                />
            ),
        },
    ];

    const threadItems = useMemo(
        () =>
            sampleThreads.map((thread) => ({
                ...thread,
                actions: (
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button className="rounded-md border border-transparent p-1 text-text-muted hover:border-border-subtle hover:bg-bg-elevated">
                            <Pencil className="h-3 w-3" />
                        </button>
                        <button className="rounded-md border border-transparent p-1 text-text-muted hover:border-border-subtle hover:bg-bg-elevated">
                            <Archive className="h-3 w-3" />
                        </button>
                        <button className="rounded-md border border-transparent p-1 text-text-muted hover:border-border-subtle hover:bg-bg-elevated">
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                ),
            })),
        []
    );

    const renderItems = useMemo<RenderItem[]>(() => {
        const items: RenderItem[] = [];
        let toolBuffer: SampleEvent[] = [];

        const flushTools = () => {
            if (toolBuffer.length > 0) {
                items.push({ type: "tools", events: toolBuffer });
                toolBuffer = [];
            }
        };

        for (const event of sampleEvents) {
            const isToolEvent = (event.kind === "assistant" && Boolean(event.toolName)) || event.kind === "tool";
            if (isToolEvent) {
                toolBuffer.push(event);
                continue;
            }
            flushTools();
            items.push({ type: "event", event });
        }

        flushTools();
        return items;
    }, []);

    const renderEvent = (event: SampleEvent, index: number) => {
        if (event.kind === "system") {
            return <SystemMessage key={`${event.id}-${index}`} content={event.content || ""} />;
        }
        return (
            <MessageBubble
                key={`${event.id}-${index}`}
                role={event.kind}
                content={event.content || ""}
                showCopy={event.kind === "assistant"}
                showTimestamp={false}
            />
        );
    };

    const renderToolGroup = (events: SampleEvent[], index: number) => {
        // Pair consecutive assistant-call / tool-result events
        const pairs: { call?: SampleEvent; result?: SampleEvent }[] = [];
        let current: { call?: SampleEvent; result?: SampleEvent } = {};
        for (const e of events) {
            if (e.kind === "assistant" && e.toolName) {
                if (current.call) pairs.push(current);
                current = { call: e };
            } else if (e.kind === "tool") {
                current.result = e;
                pairs.push(current);
                current = {};
            }
        }
        if (current.call) pairs.push(current);

        return (
            <div key={`tools-${index}`}>
                {pairs.map((pair, i) => (
                    <ToolInvocation
                        key={`tools-${index}-${i}`}
                        name={pair.call?.toolName ?? pair.result?.toolName ?? "tool"}
                        meta={pair.call?.meta ?? ""}
                        args={pair.call?.toolArgs}
                        output={pair.result?.toolOutput}
                    />
                ))}
            </div>
        );
    };

    const renderDiffPreview = (rows: DiffPreviewRow[]) => (
        <div className="mt-3 border border-border-subtle">
            {rows.map((row, index) => {
                const leftCellClass =
                    row.type === "remove"
                        ? "bg-status-error-bg text-status-error-text border-l-2 border-status-error-border"
                        : row.type === "add"
                        ? "bg-bg-app/40 text-text-muted"
                        : "";
                const rightCellClass =
                    row.type === "add"
                        ? "bg-status-success-bg text-status-success-text border-l-2 border-status-success-border"
                        : row.type === "remove"
                        ? "bg-bg-app/40 text-text-muted"
                        : "";
                const leftSign = row.type === "remove" ? "-" : row.type === "context" ? " " : "";
                const rightSign = row.type === "add" ? "+" : row.type === "context" ? " " : "";

                return (
                    <div
                        key={`diff-row-${index}`}
                        className={`grid grid-cols-[40px_minmax(0,1fr)_40px_minmax(0,1fr)] font-mono text-[10px] ${
                            row.type === "add" ? "bg-status-success-bg/30" : row.type === "remove" ? "bg-status-error-bg/30" : ""
                        }`}
                    >
                        <div className={`text-right pr-2 select-none ${row.type === "remove" ? "text-status-error-text" : "text-text-muted"}`}>
                            {row.left?.num ?? ""}
                        </div>
                        <div className={`px-2 py-1 ${leftCellClass}`}>
                            <div className="flex items-start gap-2">
                                <span className={`w-3 text-center text-[9px] ${row.type === "remove" ? "text-status-error-text" : "text-text-muted"}`}>
                                    {leftSign}
                                </span>
                                <span className="whitespace-pre-wrap">{row.left?.text ?? ""}</span>
                            </div>
                        </div>
                        <div className={`text-right pr-2 select-none ${row.type === "add" ? "text-status-success-text" : "text-text-muted"}`}>
                            {row.right?.num ?? ""}
                        </div>
                        <div className={`px-2 py-1 ${rightCellClass}`}>
                            <div className="flex items-start gap-2">
                                <span className={`w-3 text-center text-[9px] ${row.type === "add" ? "text-status-success-text" : "text-text-muted"}`}>
                                    {rightSign}
                                </span>
                                <span className="whitespace-pre-wrap">{row.right?.text ?? ""}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-12">
            <DocSection
                title="IDE Layout"
                description="Full IDE-style desktop shell: Activity Bar + dynamic sidebar + editor area + chat panel + status bar."
            >
                <DocCard title="Layout Example" actions={<InspectButton doc={componentDocs.workspaceLayout} />}>
                    <div className="rounded-xl border border-border-subtle bg-bg-app h-[640px] overflow-hidden flex flex-col">
                        {/* Title Bar */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg-surface/80">
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Numezis Desktop</div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCommandPaletteOpen(true)}
                                    className="rounded-md border border-border-subtle bg-bg-app px-3 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors flex items-center gap-2"
                                >
                                    <Search className="h-3 w-3" /> Search… <kbd className="text-[9px] opacity-60">⌘P</kbd>
                                </button>
                                <Button size="xs">New thread</Button>
                            </div>
                        </div>
                        {/* Main Body */}
                        <div className="flex flex-1 min-h-0">
                            {/* Activity Bar */}
                            <ActivityBar
                                items={activityItems}
                                activeItemId={activeSidePanel}
                                onItemClick={(item) => setActiveSidePanel(item.id)}
                                bottomItems={[{ id: "settings", icon: <Settings className="w-5 h-5" />, label: "Settings" }]}
                            />
                            {/* Sidebar */}
                            <div className="w-[240px] flex-shrink-0 border-r border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
                                <div className="flex items-center px-3 py-2 border-b border-border-subtle">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                                        {activeSidePanel === "explorer" ? "Explorer" : activeSidePanel === "search" ? "Search" : activeSidePanel === "git" ? "Source Control" : activeSidePanel === "todo" ? "Agent Tasks" : "Threads"}
                                    </span>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    {activeSidePanel === "explorer" && (
                                        <FileBrowser
                                            files={sampleFiles}
                                            selectedPath="src/app/App.tsx"
                                            expandedPaths={new Set(["src", "src/app", "src/hooks"])}
                                        />
                                    )}
                                    {activeSidePanel === "git" && (
                                        <GitPanel
                                            status={sampleGitStatus}
                                            commitMessage={gitCommitMessage}
                                            onCommitMessageChange={setGitCommitMessage}
                                        />
                                    )}
                                    {activeSidePanel === "chat" && (
                                        <ThreadFeed title="Threads" items={threadItems} activeId={activeThreadId} onSelect={(id) => setActiveThreadId(id)} />
                                    )}
                                    {activeSidePanel === "search" && (
                                        <div className="p-3"><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" /><input type="text" placeholder="Search files…" className="w-full rounded-md bg-bg-surface border border-border-subtle py-1.5 pl-8 pr-2 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none" /></div><div className="mt-4 text-xs text-text-muted text-center">Type to search</div></div>
                                    )}
                                    {activeSidePanel === "todo" && (
                                        <AgentTaskQueue
                                            tasks={taskQueue}
                                            sessionLabel="Agent Session"
                                            sessionId="thread-1"
                                            onStatusChange={(taskId, newStatus) => {
                                                setTaskQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
                                            }}
                                            onAddTask={(title) => {
                                                setTaskQueue(prev => [...prev, { id: `task-${Date.now()}`, title, status: "todo" }]);
                                            }}
                                            onRemoveTask={(taskId) => {
                                                setTaskQueue(prev => prev.filter(t => t.id !== taskId));
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                            {/* Editor Area */}
                            <div className="flex-1 flex flex-col min-w-0">
                                <EditorTabs tabs={sampleEditorTabs} activeTabId="App.tsx" />
                                <div className="flex-1 min-h-0 flex items-center justify-center">
                                    <div className="text-center text-text-muted">
                                        <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <div className="text-xs">Monaco CodeEditor renders here</div>
                                        <div className="text-[10px] mt-1">Open files from Explorer or via ⌘P</div>
                                    </div>
                                </div>
                            </div>
                            {/* Chat Panel */}
                            <div className="w-[320px] flex-shrink-0 border-l border-border-subtle bg-bg-app flex flex-col">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                                    <div className="flex items-center gap-2"><Brain className="w-3.5 h-3.5 text-text-muted" /><span className="text-xs font-medium text-text-primary">Agent Session</span></div>
                                    <button type="button" className="p-1 text-text-muted hover:text-text-primary"><X className="h-3 w-3" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                                    {renderItems.map((item, index) =>
                                        item.type === "tools" ? renderToolGroup(item.events, index) : renderEvent(item.event, index)
                                    )}
                                    <ThinkingBubble isActive summary="Agent is running…" />
                                </div>
                                {/* Context Chips */}
                                <div className="px-3 pt-2">
                                    <ContextChips chips={contextChips} onDismiss={(id) => setContextChips(p => p.filter(c => c.id !== id))} size="sm" />
                                </div>
                                <div className="border-t border-border-subtle p-3">
                                    <ChatInput value={draft} onChange={setDraft} onSend={() => setDraft("")} placeholder="Ask for follow-up changes" footerRight={<span className="text-[10px] text-text-muted">claude-4</span>} />
                                </div>
                            </div>
                        </div>
                        {/* Status Bar */}
                        <StatusBar branch="feat/ide-layout" syncStatus="synced" language="TypeScript" encoding="UTF-8" />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Activity Bar provides quick access to Explorer, Search, Git, Tasks, and Threads.",
                        "The sidebar content changes dynamically based on the active Activity Bar item.",
                        "The editor area shows CodeEditor with tabs; DiffEditor opens for agent changes.",
                        "The chat panel stays on the right for continuous AI interaction.",
                        "StatusBar provides at-a-glance info: branch, language, LLM model.",
                        "Command Palette (⌘P) provides quick access to all commands and files.",
                    ]}
                />
                <DocCode
                    code={`// New IDE Layout\n<ActivityBar items={...} />\n<FileBrowser files={files} />\n<EditorTabs tabs={tabs} />\n<CodeEditor value={content} filename="App.tsx" />\n<ChatPanel />\n<StatusBar branch="main" language="TypeScript" />\n<CommandPalette open={open} commands={commands} />`}
                />
            </DocSection>

            <DocSection
                title="Thread Sidebar"
                description="Primary list of chat threads, designed for quick scanning and selection."
            >
                <DocCard title="Thread List" actions={<InspectButton doc={componentDocs.threadFeed} />}>
                    <div className="rounded-lg border border-border-subtle bg-bg-surface h-[360px] overflow-hidden">
                        <ThreadFeed
                            title="Threads"
                            items={threadItems}
                            activeId={activeThreadId}
                            onSelect={(id) => setActiveThreadId(id)}
                            headerAction={<Button size="xs">New</Button>}
                            footer={<span>4 total</span>}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Use status dots to convey waiting vs active threads.",
                        "Keep titles short and action-oriented.",
                        "Expose rename, archive, and delete actions on hover.",
                        "Limit visible threads inside the sidebar to avoid layout shifts.",
                    ]}
                />
                <DocCode
                    code={`<ThreadFeed title="Threads" items={threads} activeId={id} onSelect={setId} />`}
                />
            </DocSection>

            <DocSection
                title="Chat Timeline"
                description="Conversation timeline with compact tool activity and clean message layout."
            >
                <DocCard title="Timeline" actions={<InspectButton doc={componentDocs.chatThread} />}>
                    <div className="space-y-3">
                        {renderItems.map((item, index) =>
                            item.type === "tools"
                                ? renderToolGroup(item.events, index)
                                : renderEvent(item.event, index)
                        )}
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Align user messages to the right and agent messages to the left.",
                        "Keep tool activity compact and easy to scan.",
                        "Keep message width under 75% for readability.",
                    ]}
                />
                <DocCode
                    code={`<div className="space-y-3">{renderItems.map(renderItem)}</div>`}
                />
            </DocSection>

            <DocSection
                title="Chat Input"
                description="Composer for sending follow-up requests, including idle and sending states."
            >
                <DocCard title="Composer" actions={<InspectButton doc={componentDocs.chatInput} />}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Idle</div>
                            <ChatInput
                                value={draft}
                                onChange={setDraft}
                                onSend={() => setDraft("")}
                                placeholder="Ask for follow-up changes"
                                footerLeft={(
                                    <Button size="xs" variant="secondary" className="flex items-center gap-2">
                                        <TerminalIcon className="h-3.5 w-3.5" />
                                        Terminal
                                    </Button>
                                )}
                                footerRight={(
                                    <span className="text-[10px] text-text-muted">lmstudio · nemotron-3-nano</span>
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Sending</div>
                            <ChatInput
                                value={sendingDraft}
                                onChange={setSendingDraft}
                                sending={sendingActive}
                                onSend={() => setSendingActive(true)}
                                onStop={() => setSendingActive(false)}
                                placeholder="Generating response"
                                footerLeft={(
                                    <Button size="xs" variant="secondary" className="flex items-center gap-2">
                                        <TerminalIcon className="h-3.5 w-3.5" />
                                        Terminal
                                    </Button>
                                )}
                                footerRight={(
                                    <span className="text-[10px] text-text-muted">lmstudio · nemotron-3-nano</span>
                                )}
                            />
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Keep the placeholder action-oriented (Ask, Review, Summarize).",
                        "Expose the stop button only while streaming.",
                        "Use footer left for quick actions like Terminal.",
                    ]}
                />
                <DocCode
                    code={`<ChatInput value={draft} onChange={setDraft} footerLeft={...} footerRight={...} />`}
                />
            </DocSection>

            <DocSection
                title="Settings Page"
                description="Mac app settings surface using SettingsPanel with dense toggle controls."
            >
                <DocCard
                    title="Preferences"
                    actions={(
                        <div className="flex gap-2">
                            <InspectButton doc={componentDocs.settingsPanel} />
                            <InspectButton doc={componentDocs.switch} />
                        </div>
                    )}
                >
                    <SettingsPanel
                        title="Workspace Preferences"
                        description="Tune the Mac app experience without leaving your workflow."
                        items={settingsItems}
                    />
                </DocCard>
                <DocRules
                    rules={[
                        "Group related settings and keep labels concise.",
                        "Use Switch for binary preferences; avoid mixed control types in one row.",
                        "Surface advanced settings below the fold.",
                    ]}
                />
                <DocCode
                    code={`<SettingsPanel title="Workspace Preferences" items={settingsItems} />`}
                />
            </DocSection>

            <DocSection
                title="Uncommitted Changes"
                description="Inline in the chat panel for reviewing and accepting or rejecting agent edits."
            >
                <DocCard title="Pending Changes" actions={<InspectButton doc={componentDocs.diffEditor} />}>
                    <div className="rounded-lg border border-border-subtle bg-bg-app h-[260px] overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                            <span>Pending changes</span>
                            <span>{sampleDiffs.length}</span>
                        </div>
                        <div className="space-y-1 border-b border-border-subtle px-2 py-2">
                            {sampleDiffs.map((diff) => (
                                <div key={`preview-${diff.id}`} className="flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs hover:bg-state-hover transition-colors">
                                    <span className="flex-1 truncate text-text-secondary">{diff.path}</span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button size="xs" variant="secondary">Accept</Button>
                                        <Button size="xs" variant="ghost">Reject</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {renderDiffPreview(sampleDiffPreviewRows)}
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Pending changes live inline in the chat panel, not a separate aside.",
                        "Clicking a file opens it in the DiffEditor (Monaco) in the editor area.",
                        "Accept/Reject buttons are exposed per file for quick triage.",
                    ]}
                />
                <DocCode
                    code={`// Changes inline in chat panel\n<div>Pending changes → click → DiffEditor tab opens</div>`}
                />
            </DocSection>

            <DocSection
                title="Activity Bar"
                description="VS Code-style icon rail on the far left for switching between sidebar panels."
            >
                <DocCard title="Activity Bar" actions={<InspectButton doc={componentDocs.activityBar} />}>
                    <div className="rounded-lg border border-border-subtle bg-bg-app h-[400px] overflow-hidden flex">
                        <ActivityBar
                            items={activityItems}
                            activeItemId={activeSidePanel}
                            onItemClick={(item) => setActiveSidePanel(item.id)}
                            bottomItems={[{ id: "settings", icon: <Settings className="w-5 h-5" />, label: "Settings" }]}
                        />
                        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
                            Sidebar content for &ldquo;{activeSidePanel}&rdquo; panel
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Clicking the active item toggles the sidebar visibility.",
                        "Badges show counts (git changes, pending tasks).",
                        "Bottom items for settings and account.",
                    ]}
                />
                <DocCode code={`<ActivityBar items={items} activeItemId={panel} onItemClick={handleClick} />`} />
            </DocSection>

            <DocSection
                title="File Explorer"
                description="File browser with directory expansion, file icons, and a search filter."
            >
                <DocCard title="FileBrowser" actions={<InspectButton doc={componentDocs.fileBrowser} />}>
                    <div className="rounded-lg border border-border-subtle bg-bg-surface h-[360px] overflow-hidden">
                        <FileBrowser
                            files={sampleFiles}
                            selectedPath="src/app/App.tsx"
                            expandedPaths={new Set(["src", "src/app", "src/hooks"])}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Single-click selects, double-click opens in editor.",
                        "Directories expand on click and lazy-load children.",
                        "Filter box narrows results for fast file access.",
                    ]}
                />
                <DocCode code={`<FileBrowser files={files} expandedPaths={expanded} onFileOpen={open} />`} />
            </DocSection>

            <DocSection
                title="Editor Tabs"
                description="Tab bar for open files with modified indicators and close buttons."
            >
                <DocCard title="EditorTabs" actions={<InspectButton doc={componentDocs.editorTabs} />}>
                    <div className="rounded-lg border border-border-subtle overflow-hidden">
                        <EditorTabs tabs={sampleEditorTabs} activeTabId="App.tsx" />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Active tab has distinct background color.",
                        "Modified files show a dot indicator that becomes a close button on hover.",
                        "Double-click pins a tab; pinned tabs show in italic.",
                    ]}
                />
                <DocCode code={`<EditorTabs tabs={tabs} activeTabId={id} onTabSelect={select} onTabClose={close} />`} />
            </DocSection>

            <DocSection
                title="Command Palette"
                description="Spotlight-style command palette for quick access to all actions and files."
            >
                <DocCard title="Command Palette" actions={<InspectButton doc={componentDocs.commandPalette} />}>
                    <div className="space-y-2">
                        <Button size="xs" onClick={() => setCommandPaletteOpen(true)}>Open Command Palette (⌘P)</Button>
                        <div className="text-xs text-text-muted">Click the button or press ⌘P to open the palette.</div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "⌘P opens the palette; Escape closes it.",
                        "Commands are grouped by category with keyboard shortcuts shown.",
                        "Recent commands appear first when no query is entered.",
                    ]}
                />
                <DocCode code={`<CommandPalette open={open} onClose={close} commands={commands} />`} />
            </DocSection>

            <DocSection
                title="Git Panel"
                description="Full source control panel with branch info, commit form, and changed files list."
            >
                <DocCard title="GitPanel" actions={<InspectButton doc={componentDocs.gitPanel} />}>
                    <div className="rounded-lg border border-border-subtle bg-bg-app h-[360px] overflow-hidden">
                        <GitPanel
                            status={sampleGitStatus}
                            commitMessage={gitCommitMessage}
                            onCommitMessageChange={setGitCommitMessage}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Branch name and ahead/behind counts visible at top.",
                        "AI-powered commit message generation via the sparkle button.",
                        "Changed files grouped with status icons (M/A/D/R).",
                    ]}
                />
                <DocCode code={`<GitPanel status={gitStatus} commitMessage={msg} onCommit={commit} />`} />
            </DocSection>

            <DocSection
                title="Context Chips & Thinking Bubble"
                description="Context chips for @mentions and thinking indicator for agent processing state."
            >
                <DocCard title="Context Chips + ThinkingBubble" actions={<div className="flex gap-2"><InspectButton doc={componentDocs.contextChips} /><InspectButton doc={componentDocs.thinkingBubble} /></div>}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Context Chips</div>
                            <ContextChips
                                chips={contextChips}
                                onDismiss={(id) => setContextChips(p => p.filter(c => c.id !== id))}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Thinking (active)</div>
                            <ThinkingBubble isActive summary="Analyzing codebase structure…" />
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Thinking (completed)</div>
                            <ThinkingBubble summary="Found 3 relevant files" content="Searched through src/ directory and identified App.tsx, useAuth.ts, and utils.ts as the most relevant files for this change." />
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Context chips auto-attach the active file; users can dismiss with ×.",
                        "File, folder, and model chips have distinct colors and icons.",
                        "ThinkingBubble pulses when active; content is expandable when complete.",
                    ]}
                />
                <DocCode code={`<ContextChips chips={chips} onDismiss={dismiss} />\n<ThinkingBubble isActive summary="Working…" />`} />
            </DocSection>

            <DocSection
                title="Status Bar"
                description="Bottom status bar showing branch, problems, language, encoding, and active LLM."
            >
                <DocCard title="StatusBar" actions={<InspectButton doc={componentDocs.statusBar} />}>
                    <div className="rounded-lg border border-border-subtle overflow-hidden">
                        <StatusBar branch="feat/ide-layout" syncStatus="synced" problems={{ errors: 0, warnings: 2 }} language="TypeScript" encoding="UTF-8" llmModel="claude-4" />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Left side: branch info, sync status, problem counts.",
                        "Right side: LLM model, cursor position, language, encoding.",
                        "Clickable items can trigger actions (e.g., click branch to switch).",
                    ]}
                />
                <DocCode code={`<StatusBar branch="main" language="TypeScript" llmModel="claude-4" />`} />
            </DocSection>

            {/* Command Palette overlay */}
            <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} commands={sampleCommands} placeholder="Type a command or search files…" />
        </div>
    );
}

// ── Command Palette overlay (rendered outside the main flow) ──
// The CommandPalette component is rendered conditionally in the layout above.

/* All tool rendering is now handled by the shared ToolInvocation component from @numezis/ui */
