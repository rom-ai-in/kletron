"use client";

import { useMemo, useState } from "react";
import {
    Archive, Check, Pencil, Trash2, Plus,
    Settings, X, Brain, Eye, Zap, User,
    Wrench, GitBranch, Paperclip, Monitor,
    FileUp, Camera, MessageSquare, Clock,
    ClipboardCheck, Play, Pause, RefreshCw,
} from "lucide-react";

import {
    Button,
    ChatInput,
    Switch,
    ContextChips,
    createFileChip,
    createFolderChip,
    createModelChip,
    ThinkingBubble,
    LLMSelector,
    SettingsPanel,
    WorktreeManager,
} from "@numezis/ui/components/design-system";
import type { ContextChip } from "@numezis/ui/components/design-system";

// Command Center components
import { TitleBar } from "@numezis/ui/components/CommandCenter/TitleBar";
import { ProjectSidebar } from "@numezis/ui/components/CommandCenter/ProjectSidebar";
import type { SidebarProject } from "@numezis/ui/components/CommandCenter/ProjectSidebar";
import { ConversationTabs } from "@numezis/ui/components/CommandCenter/ConversationTabs";
import type { ConversationTabItem } from "@numezis/ui/components/CommandCenter/ConversationTabs";
import { ConversationCenter } from "@numezis/ui/components/CommandCenter/ConversationCenter";
import type { RenderItem } from "@numezis/ui/components/CommandCenter/ConversationCenter";
import { InputBar } from "@numezis/ui/components/CommandCenter/InputBar";
import { ProjectUtilitySidebar } from "@numezis/ui/components/CommandCenter/ProjectUtilitySidebar";
import type { PendingDiffItem, FileLink } from "@numezis/ui/components/CommandCenter/ProjectUtilitySidebar";
import { InlineDiffReview } from "@numezis/ui/components/CommandCenter/InlineDiffReview";
import type { InlineDiff } from "@numezis/ui/components/CommandCenter/InlineDiffReview";
import { SlashCommandMenu } from "@numezis/ui/components/CommandCenter/SlashCommandMenu";
import type { SlashCommandItem } from "@numezis/ui/components/CommandCenter/SlashCommandMenu";
import { MultimodalMenu } from "@numezis/ui/components/CommandCenter/MultimodalMenu";
import { ReviewQueue } from "@numezis/ui/components/CommandCenter/ReviewQueue";
import type { ReviewQueueItem } from "@numezis/ui/components/CommandCenter/ReviewQueue";
import { SkillsManager } from "@numezis/ui/components/CommandCenter/SkillsManager";
import type { Skill } from "@numezis/ui/components/CommandCenter/SkillsManager";
import { AutomationsDashboard } from "@numezis/ui/components/CommandCenter/AutomationsDashboard";
import type { Automation } from "@numezis/ui/components/CommandCenter/AutomationsDashboard";
import { AgentGraphSelector } from "@numezis/ui/components/CommandCenter/AgentGraphSelector";
import type { AgentGraph } from "@numezis/ui/components/CommandCenter/AgentGraphSelector";

import { DocCard, DocCode, DocRules, DocSection } from "../../components/DocBlocks";
import { InspectButton } from "../../components/Inspector";
import { componentDocs } from "../../docs";

// ── Sample Data ──────────────────────────────────────────────────────────────

const sampleProjects: SidebarProject[] = [
    {
        id: "proj-1",
        name: "numezis-coder-mcp",
        threads: [
            { id: "thread-1", title: "Command Center layout", updatedAt: new Date().toISOString(), liveStatus: "running" },
            { id: "thread-2", title: "Design system alignment", updatedAt: new Date(Date.now() - 6 * 60000).toISOString(), liveStatus: "waiting" },
            { id: "thread-3", title: "Fix auth flow", updatedAt: new Date(Date.now() - 18 * 60000).toISOString(), liveStatus: "idle" },
            { id: "thread-4", title: "Deploy pipeline", updatedAt: new Date(Date.now() - 3600000).toISOString(), liveStatus: "completed" },
        ],
    },
    {
        id: "proj-2",
        name: "landing-page",
        threads: [
            { id: "thread-5", title: "Hero section redesign", updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(), liveStatus: "idle" },
        ],
    },
];

const sampleTabs: ConversationTabItem[] = [
    { id: "thread-1", title: "Command Center layout", liveStatus: "running" },
    { id: "thread-2", title: "Design system alignment", isPinned: true, liveStatus: "waiting" },
    { id: "thread-3", title: "Fix auth flow" },
];

const sampleRenderItems: RenderItem[] = [
    { type: "event", event: { id: "e1", kind: "user", content: "Rewrite App.tsx to use the new three-pane Command Center layout" } },
    { type: "event", event: { id: "e2", kind: "assistant", content: "I'll restructure App.tsx to use the new three-pane layout. Let me check the current file first." } },
    { type: "tools", events: [
        { id: "e3", kind: "assistant", toolName: "read_file", toolArgs: '{\n  "path": "apps/desktop/src/app/App.tsx"\n}' },
        { id: "e4", kind: "tool", toolName: "read_file", toolOutput: "// Current App.tsx (787 lines)\nimport { ActivityBar } from ...\n// VS Code-style layout..." },
    ] },
    { type: "tools", events: [
        { id: "e5", kind: "assistant", toolName: "edit_file", toolArgs: '{\n  "path": "apps/desktop/src/app/App.tsx",\n  "description": "Rewrite to three-pane layout"\n}' },
        { id: "e6", kind: "tool", toolName: "edit_file", toolOutput: "Applied edit to apps/desktop/src/app/App.tsx" },
    ] },
    { type: "event", event: { id: "e7", kind: "assistant", content: "Done. I've rewritten App.tsx to use the three-pane Command Center layout:\n\n- **Left:** `ProjectSidebar` (280px, collapsible)\n- **Center:** `ConversationCenter` with `ConversationTabs` and `InputBar`\n- **Right:** `ProjectUtilitySidebar` (300px)\n\nThe IDE components (ActivityBar, Monaco, Terminal, StatusBar) have been removed." } },
];

const samplePendingDiffs: PendingDiffItem[] = [
    { editId: "diff-1", filePath: "apps/desktop/src/app/App.tsx" },
    { editId: "diff-2", filePath: "packages/ui/src/components/CommandCenter/TitleBar.tsx" },
];

const sampleFileLinks: FileLink[] = [
    { path: "apps/desktop/src/app/App.tsx", label: "App.tsx", type: "write" },
    { path: "apps/desktop/src/types.ts", label: "types.ts", type: "read" },
    { path: "packages/ui/src/components/CommandCenter/TitleBar.tsx", label: "TitleBar.tsx", type: "write" },
    { path: "packages/ui/src/components/CommandCenter/ProjectSidebar.tsx", label: "ProjectSidebar.tsx", type: "write" },
];

const sampleInlineDiffs: InlineDiff[] = [
    {
        editId: "diff-1",
        filePath: "apps/desktop/src/app/App.tsx",
        hunks: [
            {
                id: "hunk-1",
                oldStart: 1,
                oldLines: 5,
                newStart: 1,
                newLines: 8,
                lines: [
                    " import { useEffect, useMemo, useRef, useState } from 'react';",
                    "-import { ActivityBar } from '@numezis/ui/components/design-system';",
                    "-import { FileBrowser } from '@numezis/ui/components/design-system';",
                    "-import { CodeEditor } from '@numezis/ui/components/design-system';",
                    "+import { TitleBar } from '@numezis/ui/components/CommandCenter/TitleBar';",
                    "+import { ProjectSidebar } from '@numezis/ui/components/CommandCenter/ProjectSidebar';",
                    "+import { ConversationCenter } from '@numezis/ui/components/CommandCenter/ConversationCenter';",
                    "+import { InputBar } from '@numezis/ui/components/CommandCenter/InputBar';",
                    "+import { ProjectUtilitySidebar } from '@numezis/ui/components/CommandCenter/ProjectUtilitySidebar';",
                ],
            },
        ],
    },
];

const sampleSlashCommands: SlashCommandItem[] = [
    { id: "plan", label: "plan", description: "Toggle Plan Mode (read-only proposals)", icon: <Eye className="h-3.5 w-3.5" />, action: () => {} },
    { id: "personality-pragmatic", label: "personality pragmatic", description: "Terse, execution-focused style", icon: <Zap className="h-3.5 w-3.5" />, action: () => {} },
    { id: "personality-empathetic", label: "personality empathetic", description: "Conversational, explanatory style", icon: <User className="h-3.5 w-3.5" />, action: () => {} },
    { id: "skills", label: "skills", description: "Open Skills settings", icon: <Wrench className="h-3.5 w-3.5" />, action: () => {} },
    { id: "worktree", label: "worktree", description: "Manage Git worktrees", icon: <GitBranch className="h-3.5 w-3.5" />, action: () => {} },
];

const sampleReviewQueue: ReviewQueueItem[] = [
    { threadId: "thread-1", threadTitle: "Command Center layout", projectName: "numezis-coder-mcp", pendingDiffCount: 3, completedAt: new Date(Date.now() - 120000).toISOString() },
    { threadId: "thread-4", threadTitle: "Deploy pipeline", projectName: "numezis-coder-mcp", pendingDiffCount: 1, completedAt: new Date(Date.now() - 600000).toISOString() },
];

const sampleSkills: Skill[] = [
    { id: "figma", name: "Figma", description: "Import designs from Figma frames", enabled: true, category: "design" },
    { id: "linear", name: "Linear", description: "Read and update Linear issues", enabled: true, category: "project-management" },
    { id: "vercel", name: "Vercel", description: "Deploy and manage Vercel projects", enabled: false, category: "deployment" },
    { id: "custom-audit", name: "Custom Audit", description: "Run code audit using custom rules", enabled: true, category: "custom" },
];

const sampleAutomations: Automation[] = [
    { id: "auto-1", name: "Daily issue triage", description: "Scan Linear for new issues and categorize them", schedule: "0 9 * * *", status: "active", lastRunAt: new Date(Date.now() - 24 * 3600000).toISOString() },
    { id: "auto-2", name: "Weekly release brief", description: "Generate a summary of all merged PRs", schedule: "0 9 * * 1", status: "active", lastRunAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString() },
    { id: "auto-3", name: "Security scan", description: "Run dependency audit on all packages", schedule: "0 */6 * * *", status: "paused" },
];

const sampleLLMProviders = [
    {
        id: "openai",
        label: "OpenAI",
        models: [
            { id: "gpt-4o", label: "GPT-4o" },
            { id: "o3", label: "o3 (Thinking)" },
        ],
        connected: true,
    },
    {
        id: "claude",
        label: "Anthropic",
        models: [
            { id: "claude-4-sonnet", label: "Claude 4 Sonnet" },
            { id: "claude-4-opus-thinking", label: "Claude 4 Opus (Thinking)" },
        ],
        connected: true,
    },
];

const sampleAgentGraphs: AgentGraph[] = [
    { id: "ask", name: "Ask", description: "Quick Q&A — no file modifications" },
    { id: "plan", name: "Plan", description: "Create a plan before writing code" },
    { id: "code", name: "Code", description: "Full coding agent with file access" },
];

const sampleContextChips: ContextChip[] = [
    createFileChip("App.tsx", "chip-1"),
    createFolderChip("src/hooks", "chip-2"),
    createModelChip("claude-4", "chip-3"),
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemMacAppPage() {
    const [activeThreadId, setActiveThreadId] = useState("thread-1");
    const [activeTabId, setActiveTabId] = useState("thread-1");
    const [draft, setDraft] = useState("");
    const [contextChips, setContextChips] = useState<ContextChip[]>(sampleContextChips);
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [multimodalOpen, setMultimodalOpen] = useState(false);
    const [planMode, setPlanMode] = useState(false);
    const [selectedGraphId, setSelectedGraphId] = useState("code");
    const [skills, setSkills] = useState<Skill[]>(sampleSkills);
    const [automations, setAutomations] = useState<Automation[]>(sampleAutomations);
    const [settingsState, setSettingsState] = useState({
        preventSleep: true,
        requireCmdEnter: false,
        compactDensity: false,
    });

    const settingsItems = [
        {
            id: "prevent-sleep",
            label: "Prevent sleep while running",
            description: "Keep your computer awake while the agent runs.",
            control: <Switch size="sm" checked={settingsState.preventSleep} onChange={(c) => setSettingsState((p) => ({ ...p, preventSleep: c }))} />,
        },
        {
            id: "require-cmd-enter",
            label: "Require Cmd+Enter to send",
            description: "Multiline prompts require Cmd+Enter to send.",
            control: <Switch size="sm" checked={settingsState.requireCmdEnter} onChange={(c) => setSettingsState((p) => ({ ...p, requireCmdEnter: c }))} />,
        },
        {
            id: "compact-density",
            label: "Compact density",
            description: "Reduce padding across the interface.",
            control: <Switch size="sm" checked={settingsState.compactDensity} onChange={(c) => setSettingsState((p) => ({ ...p, compactDensity: c }))} />,
        },
    ];

    return (
        <div className="space-y-12">
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* COMMAND CENTER LAYOUT */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Command Center Layout"
                description="Three-pane desktop shell with native macOS vibrancy and glass styling. Project Sidebar (left) + Conversation Center + Input Bar (center) + Project Utilities (right)."
            >
                <DocCard title="Full Layout" actions={<InspectButton doc={componentDocs.conversationCenter} />}>
                    <div className="rounded-xl border border-border-subtle glass-demo-bg h-[640px] overflow-hidden flex flex-col">
                        {/* Title Bar — uses glass-titlebar */}
                        <TitleBar
                            workspaceName="numezis-coder-mcp"
                            onOpen={() => {}}
                            onCommit={() => {}}
                            onToggleTerminal={() => {}}
                            gitDiffStats={{ additions: 12, deletions: 3 }}
                        />

                        {/* Three-Pane Body */}
                        <div className="flex flex-1 min-h-0">
                            {/* Left Sidebar — uses glass-sidebar */}
                            <ProjectSidebar
                                projects={sampleProjects}
                                activeThreadId={activeThreadId}
                                onThreadSelect={setActiveThreadId}
                                onSettings={() => {}}
                                onNewThreadInProject={() => {}}
                                onAddProject={() => {}}
                                reviewQueueCount={2}
                            />

                            {/* Center */}
                            <div className="flex-1 flex flex-col min-w-0">
                                <ConversationTabs
                                    tabs={sampleTabs}
                                    activeTabId={activeTabId}
                                    onTabSelect={setActiveTabId}
                                    onTabClose={() => {}}
                                />
                                <ConversationCenter
                                    renderItems={sampleRenderItems}
                                    conversationId="thread-1"
                                    threadTitle="Command Center layout"
                                    diffReview={
                                        <InlineDiffReview
                                            diffs={sampleInlineDiffs}
                                            onAccept={() => {}}
                                            onReject={() => {}}
                                            onOpenInIDE={() => {}}
                                            onRequestIteration={() => {}}
                                        />
                                    }
                                />
                                <InputBar
                                    value={draft}
                                    onChange={setDraft}
                                    onSend={() => setDraft("")}
                                    placeholder="Describe what you want to build..."
                                    onPaperclipClick={() => setMultimodalOpen(!multimodalOpen)}
                                    contextChips={contextChips}
                                    onDismissChip={(id) => setContextChips((p) => p.filter((c) => c.id !== id))}
                                    planMode={planMode}
                                    connected
                                    modelSelector={
                                        <LLMSelector
                                            providers={sampleLLMProviders}
                                            selectedProvider="claude"
                                            selectedModel="claude-4-sonnet"
                                            compact
                                        />
                                    }
                                />
                            </div>

                            {/* Right Sidebar */}
                            <ProjectUtilitySidebar
                                fileLinks={sampleFileLinks}
                                pendingDiffs={samplePendingDiffs}
                            />
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Three-pane layout: Left Sidebar (280px) + Center (flex) + Right Sidebar (300px).",
                        "Both sidebars are collapsible via ⌘B (left) and the toggle (right).",
                        "The center pane always shows the conversation — no code editor, no terminal.",
                        "Title bar uses native macOS traffic lights with workspace name.",
                        "All file editing happens via agent tool calls, not inline Monaco editors.",
                    ]}
                />
                <DocCode
                    code={`// Command Center Layout — with glass styling and vibrancy
<TitleBar workspaceName="..." onOpen={...} onCommit={...} onToggleTerminal={...} />
<div className="flex flex-1">
  <ProjectSidebar projects={...} onThreadSelect={...} onAddProject={...} />
  <div className="flex-1 flex flex-col">
    <ConversationTabs tabs={...} activeTabId={...} />
    <ConversationCenter renderItems={...} diffReview={...} />
    <InputBar
      value={...}
      onSend={...}
      graphSelector={<AgentGraphSelector graphs={...} />}
      modelSelector={<LLMSelector compact />}
    />
  </div>
  <ProjectUtilitySidebar fileLinks={...} pendingDiffs={...} gitData={...} />
</div>`}
                />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TITLE BAR */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Title Bar"
                description="macOS-native title bar with traffic lights, workspace name, Git actions, and terminal toggle. Uses glass-titlebar styling."
            >
                <DocCard title="TitleBar" actions={<InspectButton doc={componentDocs.titleBar} />}>
                    <div className="rounded-lg border border-border-subtle overflow-hidden">
                        <TitleBar
                            workspaceName="numezis-coder-mcp"
                            onOpen={() => {}}
                            onCommit={() => {}}
                            onToggleTerminal={() => {}}
                            gitDiffStats={{ additions: 12, deletions: 3 }}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Always render traffic lights for macOS window controls.",
                        "Workspace name shown as small uppercase label.",
                        "Right side: Open, Commit, Terminal, and Share action buttons.",
                        "Git diff stats show +additions / -deletions count.",
                        "Uses glass-titlebar for frosted glass styling on macOS.",
                        "The title bar uses app-region-drag for native window dragging.",
                    ]}
                />
                <DocCode code={`<TitleBar
  workspaceName="My Project"
  onOpen={openInIDE}
  onCommit={showGitPanel}
  onToggleTerminal={toggleTerminal}
  gitDiffStats={{ additions: 12, deletions: 3 }}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* PROJECT SIDEBAR */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Project Sidebar"
                description="Left sidebar with glass-sidebar styling. Collapsible project/thread hierarchy, live status dots, add project button, and per-project thread creation."
            >
                <DocCard title="ProjectSidebar" actions={<InspectButton doc={componentDocs.projectSidebar} />}>
                    <div className="rounded-lg border border-border-subtle glass-demo-bg h-[480px] overflow-hidden">
                        <ProjectSidebar
                            projects={sampleProjects}
                            activeThreadId={activeThreadId}
                            onThreadSelect={setActiveThreadId}
                            onSettings={() => {}}
                            onNewThreadInProject={() => {}}
                            onAddProject={() => {}}
                            onRenameThread={() => {}}
                            onArchiveThread={() => {}}
                            onDeleteThread={() => {}}
                            onRemoveProject={() => {}}
                            reviewQueueCount={2}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Uses glass-sidebar for frosted glass styling with native macOS vibrancy.",
                        "Status dots: green pulsing = running, gray = idle, orange = waiting, green solid = completed, red = error.",
                        "Projects are collapsible groups; threads are listed under each project.",
                        "'Add new project' button at top opens folder picker (⌘O shortcut).",
                        "Hover on project reveals '...' menu (remove) and new thread button.",
                        "Hover on thread reveals rename, archive, and delete actions.",
                        "Duplicate projects (same folder path) are automatically blocked.",
                        "Project names are derived from the folder name, not generic labels.",
                    ]}
                />
                <DocCode code={`<ProjectSidebar
  projects={projects}
  activeThreadId={id}
  onThreadSelect={select}
  onNewThreadInProject={createThread}
  onAddProject={addProject}
  onRemoveProject={remove}
  reviewQueueCount={2}
  onSettings={openSettings}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* CONVERSATION TABS */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Conversation Tabs"
                description="Horizontal tab bar with glass-titlebar styling for open conversation threads. Replaces the file-based EditorTabs."
            >
                <DocCard title="ConversationTabs" actions={<InspectButton doc={componentDocs.conversationTabs} />}>
                    <div className="rounded-lg border border-border-subtle overflow-hidden">
                        <ConversationTabs
                            tabs={sampleTabs}
                            activeTabId={activeTabId}
                            onTabSelect={setActiveTabId}
                            onTabClose={() => {}}
                            onTabPin={() => {}}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Tabs represent conversations, not files — no file icons or modified indicators.",
                        "Active tab has a blue bottom border accent.",
                        "Status dots show running/waiting state per thread.",
                        "Pinned tabs (double-click to pin) sort first and lack a close button.",
                        "⌘W closes the active tab; ⌘Shift+[ / ] switches between tabs.",
                    ]}
                />
                <DocCode code={`<ConversationTabs tabs={tabs} activeTabId={id} onTabSelect={select} onTabClose={close} />`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* INLINE DIFF REVIEW */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="In-Thread Diff Review"
                description="Diff cards rendered inline in the conversation stream. Replace the old separate DiffEditor approach."
            >
                <DocCard title="InlineDiffReview" actions={<InspectButton doc={componentDocs.inlineDiffReview} />}>
                    <InlineDiffReview
                        diffs={sampleInlineDiffs}
                        onAccept={() => {}}
                        onReject={() => {}}
                        onOpenInIDE={() => {}}
                        onRequestIteration={() => {}}
                    />
                </DocCard>
                <DocRules
                    rules={[
                        "Diffs render inline in the conversation, not in a separate pane.",
                        "Each file card is collapsible with a file header showing +/- counts.",
                        "Actions: Merge (apply), Reject (discard), Comment (iterate), Open in IDE.",
                        "Comments trigger a follow-up message to the agent requesting changes.",
                        "Unified diff format with green additions and red deletions.",
                    ]}
                />
                <DocCode code={`<InlineDiffReview
  diffs={diffs}
  onAccept={accept}
  onReject={reject}
  onOpenInIDE={open}
  onRequestIteration={iterate}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* INPUT BAR */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Input Bar"
                description="Enhanced chat input with glass-input styling. Features multimodal paperclip, Agent Graph selector (Ask/Plan/Code), model selector, context chips, and plan mode."
            >
                <DocCard title="InputBar" actions={<InspectButton doc={componentDocs.inputBar} />}>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Default</div>
                            <InputBar
                                value={draft}
                                onChange={setDraft}
                                onSend={() => setDraft("")}
                                placeholder="Describe what you want to build..."
                                onPaperclipClick={() => {}}
                                contextChips={contextChips}
                                onDismissChip={(id) => setContextChips((p) => p.filter((c) => c.id !== id))}
                                connected
                                modelSelector={
                                    <LLMSelector providers={sampleLLMProviders} selectedProvider="claude" selectedModel="claude-4-sonnet" compact />
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Plan Mode</div>
                            <InputBar
                                value=""
                                onChange={() => {}}
                                onSend={() => {}}
                                placeholder="Describe what you want to plan..."
                                onPaperclipClick={() => {}}
                                planMode
                                connected
                                modelSelector={
                                    <LLMSelector providers={sampleLLMProviders} selectedProvider="openai" selectedModel="o3" compact />
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Streaming</div>
                            <InputBar
                                value="Generating the new layout components..."
                                onChange={() => {}}
                                onSend={() => {}}
                                onStop={() => {}}
                                sending
                                placeholder="Agent is working..."
                                connected
                                modelSelector={
                                    <LLMSelector providers={sampleLLMProviders} selectedProvider="claude" selectedModel="claude-4-opus-thinking" compact />
                                }
                            />
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Uses glass-input for frosted glass styling on the input area.",
                        "Paperclip button opens the MultimodalMenu for file/screenshot/photo.",
                        "Agent Graph Selector (Ask/Plan/Code) controls the workflow mode.",
                        "Model selector shows current model name with dropdown for switching.",
                        "Plan Mode badge appears above the input when active.",
                        "Context chips display above the input area with dismiss buttons.",
                        "Connection dot (green/red) indicates backend connectivity.",
                    ]}
                />
                <DocCode code={`<InputBar
  value={input}
  onChange={setInput}
  onSend={send}
  onPaperclipClick={openMenu}
  planMode={planMode}
  modelSelector={<LLMSelector compact />}
  contextChips={chips}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* SLASH COMMAND MENU */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Slash Command Menu"
                description="Floating command menu with glass-elevated styling, triggered by typing / at the start of the input bar."
            >
                <DocCard title="SlashCommandMenu" actions={<InspectButton doc={componentDocs.slashCommandMenu} />}>
                    <div className="relative h-[300px] flex items-end pb-4">
                        <SlashCommandMenu
                            open
                            onClose={() => {}}
                            commands={sampleSlashCommands}
                            filter=""
                        />
                        <div className="text-[10px] text-text-muted ml-2">
                            Menu is shown open for demo. In the app, it appears above the input bar.
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Activated when typing / at the start of input.",
                        "Arrow keys navigate, Enter/Tab selects, Escape dismisses.",
                        "Commands: /plan, /personality, /skills, /worktree, /model.",
                        "Commands are filtered as you type (e.g. /per → personality).",
                        "Reuses keyboard navigation pattern from the old CommandPalette.",
                    ]}
                />
                <DocCode code={`<SlashCommandMenu
  open={slashMenuOpen}
  onClose={close}
  commands={commands}
  filter={input}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MULTIMODAL MENU */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Multimodal Menu"
                description="Paperclip dropdown for attaching files, capturing screenshots, or taking photos."
            >
                <DocCard title="MultimodalMenu" actions={<InspectButton doc={componentDocs.multimodalMenu} />}>
                    <div className="relative h-[200px] flex items-end pb-4">
                        <MultimodalMenu
                            open
                            onClose={() => {}}
                            onIncludeFile={() => {}}
                            onTakeScreenshot={() => {}}
                        />
                        <div className="text-[10px] text-text-muted ml-2">
                            Paperclip dropdown. Photo option is disabled (future feature).
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Three options: Include File, Take Screenshot, Take Photo (future).",
                        "File picker uses Electron dialog.showOpenDialog with multi-select.",
                        "Screenshot uses Electron desktopCapturer API.",
                        "Selected files/images are added as context chips.",
                    ]}
                />
                <DocCode code={`<MultimodalMenu
  open={open}
  onClose={close}
  onIncludeFile={pickFile}
  onTakeScreenshot={capture}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* PROJECT UTILITY SIDEBAR */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Project Utility Sidebar"
                description="Right sidebar showing pending changes, project file links, and quick actions."
            >
                <DocCard title="ProjectUtilitySidebar" actions={<InspectButton doc={componentDocs.projectUtilitySidebar} />}>
                    <div className="rounded-lg border border-border-subtle glass-demo-bg h-[400px] overflow-hidden">
                        <ProjectUtilitySidebar
                            fileLinks={sampleFileLinks}
                            pendingDiffs={samplePendingDiffs}
                            onAcceptDiff={() => {}}
                            onRejectDiff={() => {}}
                            onOpenInIDE={() => {}}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Pending changes section shows files with accept/reject buttons.",
                        "Project files section lists all files touched in the conversation.",
                        "Files can be opened in an external IDE with one click.",
                        "No Monaco editor — this is a lightweight context panel.",
                    ]}
                />
                <DocCode code={`<ProjectUtilitySidebar
  fileLinks={files}
  pendingDiffs={diffs}
  onAcceptDiff={accept}
  onOpenInIDE={open}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* REVIEW QUEUE */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Review Queue"
                description="Central inbox for threads with completed tasks or pending diffs awaiting human review."
            >
                <DocCard title="ReviewQueue" actions={<InspectButton doc={componentDocs.reviewQueue} />}>
                    <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden max-w-md">
                        <ReviewQueue items={sampleReviewQueue} onItemClick={() => {}} />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Shows count badge for total items awaiting review.",
                        "Each item displays thread title, project name, pending changes count, and completion time.",
                        "Clicking an item opens the thread in the conversation center.",
                        "Accessible from the left sidebar (below project threads).",
                    ]}
                />
                <DocCode code={`<ReviewQueue items={items} onItemClick={selectThread} />`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* AGENT GRAPH SELECTOR */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Agent Graph Selector"
                description="Segmented control for selecting the agent workflow mode: Ask (Q&A), Plan (proposals), or Code (full agent). Replaces the old 'Instant vs Thinking' concept."
            >
                <DocCard title="AgentGraphSelector">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Default (Code selected)</div>
                            <AgentGraphSelector
                                graphs={sampleAgentGraphs}
                                selectedGraphId={selectedGraphId}
                                onGraphSelect={setSelectedGraphId}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Loading state</div>
                            <AgentGraphSelector
                                graphs={[]}
                                loading
                            />
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Three modes: Ask (quick Q&A), Plan (read-only proposals), Code (full coding agent).",
                        "Maps to backend agent graphs — graphs are fetched from the API.",
                        "Placed in the InputBar footer, left of the model selector.",
                        "Replaces the previous 'Instant vs Thinking' segmented toggle.",
                        "Available graphs and descriptions also shown in Settings > Agent Graphs.",
                    ]}
                />
                <DocCode code={`<AgentGraphSelector
  graphs={models.graphs}
  selectedGraphId={models.selectedGraph}
  onGraphSelect={models.setSelectedGraph}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MODEL SELECTOR */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Model Selector"
                description="Compact model name with dropdown chevron in the input bar footer. Agent workflow is selected via the separate Agent Graph Selector (Ask / Plan / Code)."
            >
                <DocCard title="LLMSelector (compact)" actions={<InspectButton doc={componentDocs.chatInput} />}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Claude (selected)</div>
                            <LLMSelector providers={sampleLLMProviders} selectedProvider="claude" selectedModel="claude-4-sonnet" compact />
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">OpenAI (selected)</div>
                            <LLMSelector providers={sampleLLMProviders} selectedProvider="openai" selectedModel="o3" compact />
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Compact mode shows only the model name + dropdown chevron.",
                        "Clicking opens the full provider/model dropdown for switching.",
                        "Agent workflow selection (Ask / Plan / Code) is handled by the Agent Graph Selector.",
                        "Model changes are persisted to the backend via PUT /api/llm-config.",
                        "The full provider configuration UI is available in Settings.",
                    ]}
                />
                <DocCode code={`<LLMSelector providers={providers} selectedProvider={p} selectedModel={m} compact />`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* SKILLS MANAGER */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Skills Manager"
                description="Settings UI for managing skills — bundles of instructions/scripts for external tool integration."
            >
                <DocCard title="SkillsManager" actions={<InspectButton doc={componentDocs.skillsManager} />}>
                    <div className="max-w-lg">
                        <SkillsManager
                            skills={skills}
                            onAdd={(name) => setSkills((p) => [...p, { id: name.toLowerCase(), name, description: `Custom: ${name}`, enabled: true, category: "custom" }])}
                            onRemove={(id) => setSkills((p) => p.filter((s) => s.id !== id))}
                            onToggle={(id, enabled) => setSkills((p) => p.map((s) => s.id === id ? { ...s, enabled } : s))}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Skills are grouped by category: Design, Project Management, Deployment, Custom.",
                        "Each skill has an enable/disable toggle and a remove button.",
                        "Add Skill creates a new SKILL.md template in .agent/skills/.",
                        "Edit opens the SKILL.md in an external editor.",
                        "Extends the existing MCP server configuration pattern.",
                    ]}
                />
                <DocCode code={`<SkillsManager
  skills={skills}
  onAdd={addSkill}
  onToggle={toggleSkill}
  onRemove={removeSkill}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* AUTOMATIONS DASHBOARD */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Automations Dashboard"
                description="Scheduled background tasks that run agent workflows on a cron schedule."
            >
                <DocCard title="AutomationsDashboard" actions={<InspectButton doc={componentDocs.automationsDashboard} />}>
                    <div className="max-w-lg">
                        <AutomationsDashboard
                            automations={automations}
                            onAdd={(name, desc, schedule) => setAutomations((p) => [...p, { id: `auto-${Date.now()}`, name, description: desc, schedule, status: "active" }])}
                            onRemove={(id) => setAutomations((p) => p.filter((a) => a.id !== id))}
                            onToggle={(id) => setAutomations((p) => p.map((a) => a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a))}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Automations reuse backend deep-agent logic.",
                        "Schedule presets: hourly, every 6h, daily, weekly, or custom cron.",
                        "Status indicators: active (green play), paused (gray), completed (check), failed (red x).",
                        "Run Now triggers an immediate execution outside the schedule.",
                        "Results land in the Review Queue for human review.",
                    ]}
                />
                <DocCode code={`<AutomationsDashboard
  automations={list}
  onAdd={addAutomation}
  onToggle={toggleAutomation}
  onRunNow={runNow}
/>`} />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* SETTINGS */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Settings Page"
                description="Mac app settings using SettingsPanel with dense toggle controls."
            >
                <DocCard
                    title="Preferences"
                    actions={<InspectButton doc={componentDocs.settingsPanel} />}
                >
                    <SettingsPanel
                        title="Workspace Preferences"
                        description="Tune the Command Center experience without leaving your workflow."
                        items={settingsItems}
                    />
                </DocCard>
                <DocRules
                    rules={[
                        "Settings sections: General, Configuration, Personalization, MCP, Skills, Automations, Agent Graphs, Environments, Worktrees, Archived.",
                        "Settings cards use glass-card styling for frosted glass panels.",
                        "Agent Graph selection (Ask / Plan / Code) available in the settings graph list.",
                        "Personality toggle (Pragmatic vs Empathetic) controls agent communication style.",
                        "Keep labels concise; use Switch for binary preferences.",
                    ]}
                />
                <DocCode
                    code={`<SettingsPanel title="Workspace Preferences" items={settingsItems} />`}
                />
            </DocSection>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* CONTEXT CHIPS & THINKING */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Context Chips & Thinking Bubble"
                description="Context chips for @mentions and thinking indicator for agent processing state."
            >
                <DocCard title="Context Chips + ThinkingBubble" actions={<InspectButton doc={componentDocs.contextChips} />}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-text-muted">Context Chips</div>
                            <ContextChips
                                chips={contextChips}
                                onDismiss={(id) => setContextChips((p) => p.filter((c) => c.id !== id))}
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

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* WORKTREE MANAGER */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <DocSection
                title="Worktree Manager"
                description="Git worktree management with agent isolation indicators and auto-branch creation."
            >
                <DocCard title="WorktreeManager" actions={<InspectButton doc={componentDocs.chatInput} />}>
                    <div className="max-w-lg">
                        <WorktreeManager
                            worktrees={[
                                { path: "/Users/dev/project", branch: "main", isMain: true },
                                { path: "/Users/dev/project-wt-feat", branch: "feat/command-center", isMain: false, agentThreadId: "thread-1", agentLabel: "Command Center layout" },
                                { path: "/Users/dev/project-wt-fix", branch: "fix/auth-flow", isMain: false },
                            ]}
                            activeWorktree="/Users/dev/project"
                            onCreateForAgent={() => {}}
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Each agent can operate in an isolated worktree to prevent merge conflicts.",
                        "Agent isolation badge shows which thread is using a worktree.",
                        "'Create Isolated Worktree for Agent' auto-generates a branch name.",
                        "Active worktree is highlighted with a green check.",
                    ]}
                />
                <DocCode code={`<WorktreeManager
  worktrees={worktrees}
  activeWorktree={path}
  onCreateForAgent={createForAgent}
/>`} />
            </DocSection>
        </div>
    );
}
