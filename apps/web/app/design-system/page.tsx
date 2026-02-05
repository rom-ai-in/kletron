"use client";

import React, { useState } from "react";
import {
    Loader2,
    Settings,
    User,
    Zap,
    Play,
    Pause,
    CheckCircle2,
    XCircle,
    Clock,
    Folder,
    MoreHorizontal,
    Plus,
    Users,
    Mail,
} from "lucide-react";

// Import from central barrel
import {
    // UI Components
    Button,
    Panel,
    Modal,
    Skeleton,
    Selector, type SelectorOption,
    CommandPalette, CommandIcons,
    FileTree, type FileTreeNode,
    EditorTabs, type EditorTab,
    StatusBar,
    ActivityBar, defaultActivityItems, defaultBottomItems,
    // Agent Components
    ThinkingBubble,
    ToolLog, type ToolCall,
    DiffApproval, type DiffFile, type DiffState,
    ContextChips, createFileChip, createAgentChip, createModelChip,
    InlineCompletion,
    // New v4.1 Components
    Badge,
    Input,
    SearchInput,
    PasswordInput,
    Textarea,
    Toggle, Switch,
    Checkbox, CheckboxGroup,
    Radio, RadioGroup,
    Tabs, TabsList, TabTrigger, TabContent,
    ToastProvider, useToast,
    Tooltip,
    Card, CardHeader, CardContent, CardFooter, StatCard, FeatureCard,
    EmptyState, LoadingState, ErrorState,
    Avatar, AvatarGroup,
    ProgressBar, CircularProgress,
    ChatInput,
    ThreadFeed,
    ToolUsePanel,
    SettingsPanel,
    WorkspaceLayout,
} from "@numezis/ui/components/design-system";

const TABS = ["Foundation", "Components", "Patterns", "Portal", "Mac App", "Agent"] as const;
type TabType = typeof TABS[number];
type MacAppView = "app" | "settings";

// Sample data for demos
const sampleFileTree: FileTreeNode[] = [
    {
        id: 'src', name: 'src', type: 'folder', children: [
            {
                id: 'src/components', name: 'components', type: 'folder', children: [
                    { id: 'src/components/Button.tsx', name: 'Button.tsx', type: 'file' },
                    { id: 'src/components/Modal.tsx', name: 'Modal.tsx', type: 'file' },
                ]
            },
            { id: 'src/index.ts', name: 'index.ts', type: 'file' },
        ]
    },
    { id: 'package.json', name: 'package.json', type: 'file' },
    { id: 'README.md', name: 'README.md', type: 'file' },
];

const sampleTabs: EditorTab[] = [
    { id: '1', filename: 'Button.tsx', filepath: 'src/components/Button.tsx' },
    { id: '2', filename: 'Modal.tsx', filepath: 'src/components/Modal.tsx', isModified: true },
    { id: '3', filename: 'index.ts', filepath: 'src/index.ts' },
];

const sampleTools: ToolCall[] = [
    { id: '1', name: 'read_file', args: 'auth.ts', status: 'success' },
    { id: '2', name: 'edit_file', args: 'middleware.ts', status: 'running' },
    { id: '3', name: 'run_command', args: 'npm test', status: 'error' },
];

const sampleDiffFiles: DiffFile[] = [
    { id: 'diff-1', filename: 'auth.ts', additions: 12, deletions: 3, hunks: [{ oldStart: 1, newStart: 1, lines: [{ type: 'context', content: '// existing code...' }, { type: 'remove', content: "const old = 'value';" }, { type: 'add', content: "const new = 'updated';" }] }] },
    { id: 'diff-2', filename: 'jwt.ts', additions: 45, deletions: 0, isNew: true },
    { id: 'diff-3', filename: '.env', additions: 1, deletions: 0 },
];

const sampleCommands = [
    { id: 'new-file', label: 'New File', shortcut: '⌘N', icon: CommandIcons.file, category: 'File' },
    { id: 'open-settings', label: 'Open Settings', shortcut: '⌘,', icon: CommandIcons.settings, category: 'Preferences' },
    { id: 'open-terminal', label: 'Toggle Terminal', shortcut: '⌘`', icon: CommandIcons.terminal, category: 'View' },
    { id: 'git-commit', label: 'Git: Commit', shortcut: '⌘⇧G', icon: CommandIcons.git, category: 'Source Control' },
];

const sampleSelectorOptions: SelectorOption[] = [
    { id: 'gpt-4o', label: 'GPT-4o', sub: 'OpenAI flagship model' },
    { id: 'claude-3.5', label: 'Claude 3.5 Sonnet', sub: 'Anthropic latest' },
    { id: 'gemini-pro', label: 'Gemini Pro', sub: 'Google DeepMind' },
    { id: 'local', label: 'LM Studio', sub: 'Local inference' },
];

const sampleThreads = [
    { id: 'thread-1', title: 'Explore workspace', subtitle: 'Awaiting response', meta: '2m ago', status: 'waiting' as const, badge: '3' },
    { id: 'thread-2', title: 'Refactor auth flow', subtitle: 'Agent replied', meta: '14m ago', status: 'active' as const },
    { id: 'thread-3', title: 'Fix failing tests', subtitle: 'Idle', meta: '1h ago', status: 'idle' as const },
    { id: 'thread-4', title: 'Summarize repo', subtitle: 'Idle', meta: '3h ago', status: 'idle' as const },
    { id: 'thread-5', title: 'Vector index cleanup', subtitle: 'Awaiting response', meta: 'Yesterday', status: 'waiting' as const },
    { id: 'thread-6', title: 'Upgrade dependencies', subtitle: 'Idle', meta: 'Jan 31', status: 'idle' as const },
    { id: 'thread-7', title: 'Design system audit', subtitle: 'Agent replied', meta: 'Jan 29', status: 'active' as const },
];

const sampleToolUse = [
    { id: 'tool-1', name: 'read_file', detail: 'apps/web/app/app/explore/page.tsx', status: 'success' as const, meta: '120ms' },
    { id: 'tool-2', name: 'edit_file', detail: 'packages/ui/src/components/Agent/ActiveSession.tsx', status: 'running' as const, meta: '2s' },
    { id: 'tool-3', name: 'run_command', detail: 'npm run test', status: 'error' as const, meta: 'failed' },
    { id: 'tool-4', name: 'search', detail: 'design system updates', status: 'pending' as const },
];

export default function DesignSystemPage() {
    const [activeTab, setActiveTab] = useState<TabType>("Foundation");
    const [showModal, setShowModal] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    const [thoughtsExpanded, setThoughtsExpanded] = useState(true);
    const [toolsExpanded, setToolsExpanded] = useState(true);
    const [diffStates, setDiffStates] = useState<Record<string, DiffState>>({
        'diff-1': 'pending', 'diff-2': 'pending', 'diff-3': 'pending',
    });
    const [selectedFileId, setSelectedFileId] = useState<string>();
    const [activeTabId, setActiveTabId] = useState('1');
    const [activeActivityId, setActiveActivityId] = useState('explorer');

    const [selectedModel, setSelectedModel] = useState('gpt-4o');
    const [workspaceDraft, setWorkspaceDraft] = useState('');
    const [globalDraft, setGlobalDraft] = useState('');
    const [settingsState, setSettingsState] = useState({
        autoApprove: true,
        smartNotifications: false,
        compactUI: true,
    });
    const [macAppView, setMacAppView] = useState<MacAppView>("app");
    const [macSettingsSection, setMacSettingsSection] = useState("general");
    const [macSettingsState, setMacSettingsState] = useState({
        preventSleep: true,
        requireCmdEnter: true,
        opaqueBackground: false,
        pointerCursors: true,
        completionNotifications: true,
    });

    const handleApprove = (id: string) => setDiffStates(prev => ({ ...prev, [id]: 'approved' }));
    const handleReject = (id: string) => setDiffStates(prev => ({ ...prev, [id]: 'rejected' }));
    const handleApproveAll = () => setDiffStates({ 'diff-1': 'approved', 'diff-2': 'approved', 'diff-3': 'approved' });
    const handleRejectAll = () => setDiffStates({ 'diff-1': 'rejected', 'diff-2': 'rejected', 'diff-3': 'rejected' });
    const handleReset = () => setDiffStates({ 'diff-1': 'pending', 'diff-2': 'pending', 'diff-3': 'pending' });

    const settingsItems = [
        {
            id: 'auto-approve',
            label: 'Auto-approve safe edits',
            description: 'Skip confirmations for low-risk changes.',
            control: (
                <Switch
                    size="sm"
                    checked={settingsState.autoApprove}
                    onChange={(checked) => setSettingsState((prev) => ({ ...prev, autoApprove: checked }))}
                />
            ),
        },
        {
            id: 'smart-notifications',
            label: 'Smart notifications',
            description: 'Only alert when the agent needs input.',
            control: (
                <Switch
                    size="sm"
                    checked={settingsState.smartNotifications}
                    onChange={(checked) => setSettingsState((prev) => ({ ...prev, smartNotifications: checked }))}
                />
            ),
        },
        {
            id: 'compact-ui',
            label: 'Compact density',
            description: 'Reduce padding across panels.',
            control: (
                <Switch
                    size="sm"
                    checked={settingsState.compactUI}
                    onChange={(checked) => setSettingsState((prev) => ({ ...prev, compactUI: checked }))}
                />
            ),
        },
    ];

    return (
        <div className="min-h-screen bg-bg-app">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🧠</span>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary">Numezis Design System</h1>
                            <p className="text-xs text-text-muted">Cursor-Level UI Reference • v4.0</p>
                            <p className="text-[10px] text-amber-400 uppercase tracking-[0.2em] mt-1">
                                Mac App preview—expect the UI to evolve.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs">Custom Mac App</span>
                        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">v4.0</span>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav className="sticky top-[73px] z-30 border-b border-border-subtle bg-bg-surface">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 py-2">
                        {TABS.map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab
                                    ? 'bg-state-selected text-text-primary border border-border-strong'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-state-hover'
                                    }`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">

                {/* ========== FOUNDATION TAB ========== */}
                {activeTab === "Foundation" && (
                    <div className="space-y-12">
                        {/* Colors */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Color Tokens</h2>
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-text-secondary">Backgrounds</h3>
                                    <div className="space-y-2">
                                        {[
                                            { name: "--bg-app", class: "bg-bg-app", desc: "Zinc 950" },
                                            { name: "--bg-surface", class: "bg-bg-surface", desc: "Zinc 900" },
                                            { name: "--bg-elevated", class: "bg-bg-elevated", desc: "Zinc 800" },
                                        ].map((t) => (
                                            <div key={t.name} className="flex items-center gap-3 p-2 rounded border border-border-subtle">
                                                <div className={`w-10 h-10 rounded ${t.class} border border-border-subtle`} />
                                                <div>
                                                    <p className="text-xs font-mono text-text-primary">{t.name}</p>
                                                    <p className="text-[10px] text-text-muted">{t.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-text-secondary">Desktop UI Colors</h3>
                                    <div className="space-y-2">
                                        {[
                                            { name: "--shell-bg", hex: "#1e1e1e", desc: "Shell" },
                                            { name: "--topbar-bg", hex: "#333333", desc: "Top Bar" },
                                            { name: "--status-pill", hex: "#007acc", desc: "Status" },
                                        ].map((t) => (
                                            <div key={t.name} className="flex items-center gap-3 p-2 rounded border border-border-subtle">
                                                <div className="w-10 h-10 rounded border border-border-subtle" style={{ background: t.hex }} />
                                                <div>
                                                    <p className="text-xs font-mono text-text-primary">{t.name}</p>
                                                    <p className="text-[10px] text-text-muted">{t.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-text-secondary">Agent Colors (v4.0)</h3>
                                    <div className="space-y-2">
                                        {[
                                            { name: "--agent-thinking", class: "bg-violet-500", desc: "Reasoning" },
                                            { name: "--agent-tool", class: "bg-amber-500", desc: "Tool Execution" },
                                            { name: "--agent-success", class: "bg-emerald-500", desc: "Completed" },
                                            { name: "--agent-error", class: "bg-rose-500", desc: "Failed" },
                                            { name: "--agent-running", class: "bg-sky-500", desc: "In Progress" },
                                        ].map((t) => (
                                            <div key={t.name} className="flex items-center gap-3 p-2 rounded border border-border-subtle">
                                                <div className={`w-10 h-10 rounded ${t.class}`} />
                                                <div>
                                                    <p className="text-xs font-mono text-text-primary">{t.name}</p>
                                                    <p className="text-[10px] text-text-muted">{t.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Typography */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Typography</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <p className="text-2xl font-bold text-text-primary">Heading XL (text-2xl)</p>
                                <p className="text-xl font-semibold text-text-primary">Heading L (text-xl)</p>
                                <p className="text-lg font-medium text-text-primary">Heading M (text-lg)</p>
                                <p className="text-sm text-text-primary">Body (text-sm)</p>
                                <p className="text-xs text-text-secondary">Small (text-xs)</p>
                                <p className="text-[10px] text-text-muted">Tiny (text-[10px])</p>
                                <p className="font-mono text-xs text-text-secondary">Monospace (font-mono)</p>
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== COMPONENTS TAB ========== */}
                {activeTab === "Components" && (
                    <div className="space-y-12">
                        {/* Buttons */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Buttons</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Variants</h4>
                                    <div className="flex flex-wrap gap-3">
                                        <Button variant="primary">Primary</Button>
                                        <Button variant="secondary">Secondary</Button>
                                        <Button variant="ghost">Ghost</Button>
                                        <Button variant="danger">Danger</Button>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Sizes</h4>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button size="xs">Extra Small</Button>
                                        <Button size="sm">Small</Button>
                                        <Button size="md">Medium</Button>
                                        <Button size="lg">Large</Button>
                                        <Button size="icon"><Plus className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">States</h4>
                                    <div className="flex flex-wrap gap-3">
                                        <Button loading>Loading</Button>
                                        <Button disabled>Disabled</Button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Badges */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Status Badges</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { label: "COMPLETED", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
                                        { label: "RUNNING", class: "bg-sky-500/10 text-sky-400 border-sky-500/20", icon: Play },
                                        { label: "PAUSED", class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: Pause },
                                        { label: "FAILED", class: "bg-rose-500/10 text-rose-400 border-rose-500/20", icon: XCircle },
                                        { label: "PENDING", class: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
                                    ].map((b) => (
                                        <span key={b.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${b.class}`}>
                                            <b.icon className="w-3 h-3" />{b.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Modal & Panel */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Modal & Panel</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Modal</h4>
                                    <Button onClick={() => setShowModal(true)}>Open Modal</Button>
                                    <Modal open={showModal} onClose={() => setShowModal(false)} title="Modal Title" subtitle="This is a modal subtitle">
                                        <div className="text-sm text-text-secondary">Modal content goes here.</div>
                                    </Modal>
                                </div>
                                <Panel title="Panel Example" headerAction={<Button size="xs">Action</Button>}>
                                    <div className="p-4 text-sm text-text-secondary">Panel content</div>
                                </Panel>
                            </div>
                        </section>

                        {/* Loading States */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Loading States</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <div className="space-y-2">
                                    <Skeleton width="w-3/4" height="h-4" />
                                    <Skeleton width="w-1/2" height="h-4" />
                                    <Skeleton width="w-2/3" height="h-4" />
                                </div>
                                <div className="flex gap-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                                    <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                                </div>
                            </div>
                        </section>

                        {/* NEW: Badge Component */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Badge (v4.1)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Variants</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge>Default</Badge>
                                        <Badge variant="info">Info</Badge>
                                        <Badge variant="success">Success</Badge>
                                        <Badge variant="warning">Warning</Badge>
                                        <Badge variant="error">Error</Badge>
                                        <Badge variant="running">Running</Badge>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">With Icons</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="success" icon={CheckCircle2}>Completed</Badge>
                                        <Badge variant="warning" icon={Clock}>Pending</Badge>
                                        <Badge variant="error" icon={XCircle}>Failed</Badge>
                                        <Badge variant="info" icon={Loader2}>Running</Badge>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* NEW: Form Inputs */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Form Inputs (v4.1)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-medium text-text-secondary">Input</h4>
                                        <Input placeholder="Default input" />
                                        <Input placeholder="With icon" leftIcon={Mail} />
                                        <SearchInput placeholder="Search..." />
                                        <PasswordInput placeholder="Password" />
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-medium text-text-secondary">Textarea</h4>
                                        <Textarea placeholder="Enter your message..." rows={3} />
                                        <Textarea placeholder="With character count" maxLength={100} rows={2} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* NEW: Toggle & Checkbox */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Toggles & Checkboxes (v4.1)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-medium text-text-secondary">Toggle / Switch</h4>
                                        <div className="flex flex-col gap-3">
                                            <Toggle label="Enable notifications" />
                                            <Toggle label="Dark mode" defaultChecked />
                                            <Switch label="Auto-save" size="sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-medium text-text-secondary">Checkbox</h4>
                                        <div className="flex flex-col gap-3">
                                            <Checkbox label="Accept terms and conditions" />
                                            <Checkbox label="Subscribe to newsletter" defaultChecked />
                                            <Checkbox label="Disabled option" disabled />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* NEW: Avatar */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Avatar (v4.1)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Sizes</h4>
                                    <div className="flex items-center gap-3">
                                        <Avatar name="John Doe" size="xs" />
                                        <Avatar name="Jane Smith" size="sm" />
                                        <Avatar name="Bob Wilson" size="md" />
                                        <Avatar name="Alice Brown" size="lg" />
                                        <Avatar name="Tom Davis" size="xl" />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Avatar Group</h4>
                                    <AvatarGroup max={4}>
                                        <Avatar name="John Doe" />
                                        <Avatar name="Jane Smith" />
                                        <Avatar name="Bob Wilson" />
                                        <Avatar name="Alice Brown" />
                                        <Avatar name="Tom Davis" />
                                        <Avatar name="Chris Evans" />
                                    </AvatarGroup>
                                </div>
                            </div>
                        </section>

                        {/* NEW: Progress */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Progress (v4.1)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <div className="space-y-3">
                                    <h4 className="text-xs font-medium text-text-secondary">Progress Bar</h4>
                                    <ProgressBar value={25} showLabel />
                                    <ProgressBar value={60} variant="success" showLabel />
                                    <ProgressBar value={90} variant="warning" showLabel />
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Circular Progress</h4>
                                    <div className="flex items-center gap-6">
                                        <CircularProgress value={25} size={32} />
                                        <CircularProgress value={50} size={48} showLabel />
                                        <CircularProgress value={75} size={64} showLabel />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* NEW: Feedback States */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Feedback States (v4.1)</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Empty State</h4>
                                    <EmptyState
                                        variant="no-data"
                                        title="No items"
                                        description="Create your first item to get started."
                                        size="sm"
                                    />
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Loading State</h4>
                                    <LoadingState message="Loading data..." size="sm" />
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Error State</h4>
                                    <ErrorState
                                        title="Error"
                                        message="Failed to load data."
                                        size="sm"
                                        onRetry={() => alert('Retrying...')}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* NEW: Tooltip */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Tooltip (v4.1)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex flex-wrap gap-4">
                                    <Tooltip content="This is a tooltip">
                                        <Button variant="secondary">Hover me (top)</Button>
                                    </Tooltip>
                                    <Tooltip content="Bottom tooltip" position="bottom">
                                        <Button variant="secondary">Hover me (bottom)</Button>
                                    </Tooltip>
                                    <Tooltip content="Left tooltip" position="left">
                                        <Button variant="secondary">Hover me (left)</Button>
                                    </Tooltip>
                                    <Tooltip content="Right tooltip" position="right">
                                        <Button variant="secondary">Hover me (right)</Button>
                                    </Tooltip>
                                </div>
                            </div>
                        </section>

                        {/* NEW: Cards */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Cards (v4.1)</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <Card>
                                    <CardHeader>
                                        <h3 className="text-sm font-medium text-text-primary">Basic Card</h3>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-text-secondary">Card content goes here.</p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button size="sm">Action</Button>
                                    </CardFooter>
                                </Card>
                                <StatCard
                                    title="Total Users"
                                    value="1,234"
                                    change={{ value: "+12.5%", positive: true }}
                                />
                                <FeatureCard
                                    icon={Zap}
                                    title="Fast Performance"
                                    description="Optimized for speed and efficiency."
                                />
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== PATTERNS TAB ========== */}
                {activeTab === "Patterns" && (
                    <div className="space-y-12">
                        {/* Card Patterns */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Card Patterns</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface hover:border-border-strong transition-colors">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-text-primary">Feature Card</h4>
                                            <p className="text-[10px] text-text-muted">With icon</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-secondary">Card description text goes here.</p>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-medium text-text-primary">Stat Card</h4>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">+12%</span>
                                    </div>
                                    <p className="text-2xl font-bold text-text-primary">1,234</p>
                                    <p className="text-xs text-text-muted">Total items</p>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-text-primary truncate">User Card</h4>
                                            <p className="text-[10px] text-text-muted">user@example.com</p>
                                        </div>
                                        <Button size="xs" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Empty State */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Empty States</h2>
                            <div className="p-8 rounded-lg border border-border-subtle bg-bg-surface text-center">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
                                    <Folder className="w-6 h-6 text-text-muted" />
                                </div>
                                <h4 className="text-sm font-medium text-text-primary mb-1">No items found</h4>
                                <p className="text-xs text-text-muted mb-4">Get started by creating your first item.</p>
                                <Button><Plus className="w-4 h-4 mr-2" />Create Item</Button>
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== PORTAL TAB (/app) ========== */}
                {activeTab === "Portal" && (
                    <div className="space-y-12">
                        {/* Chat Input */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Chat Input</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <ChatInput
                                    value={workspaceDraft}
                                    onChange={setWorkspaceDraft}
                                    placeholder="Ask anything…"
                                    onSend={() => setWorkspaceDraft('')}
                                    footerLeft={(
                                        <div className="flex items-center gap-2">
                                            <Selector
                                                label="LLM"
                                                value={selectedModel}
                                                options={sampleSelectorOptions}
                                                onSelect={setSelectedModel}
                                                size="sm"
                                                direction="up"
                                            />
                                            <span className="text-[10px] text-text-muted">⌘↵ to send</span>
                                        </div>
                                    )}
                                />
                            </div>
                        </section>

                        {/* Feed (7 Threads) */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Feed (7 Threads)</h2>
                            <div className="rounded-lg border border-border-subtle bg-bg-surface h-[360px]">
                                <ThreadFeed
                                    title="Feed"
                                    items={sampleThreads}
                                    activeId="thread-1"
                                    onSelect={(id) => console.log('select', id)}
                                    headerAction={<Button size="xs">New</Button>}
                                    footer={<span>7 total</span>}
                                />
                            </div>
                        </section>

                        {/* Tool Use */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Tool Use</h2>
                            <ToolUsePanel items={sampleToolUse} />
                        </section>

                        {/* Settings */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Settings</h2>
                            <SettingsPanel
                                title="Workspace Preferences"
                                description="Tune the agent experience without leaving the app."
                                items={settingsItems}
                            />
                        </section>
                    </div>
                )}

                {/* ========== MAC APP TAB ========== */}
                {activeTab === "Mac App" && (
                    <div className="space-y-12">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMacAppView("app")}
                                className={`px-3 py-1.5 text-xs rounded-md ${macAppView === "app"
                                    ? 'bg-state-selected text-text-primary border border-border-strong'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-state-hover'
                                    }`}
                            >
                                App
                            </button>
                            <button
                                onClick={() => setMacAppView("settings")}
                                className={`px-3 py-1.5 text-xs rounded-md ${macAppView === "settings"
                                    ? 'bg-state-selected text-text-primary border border-border-strong'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-state-hover'
                                    }`}
                            >
                                Settings
                            </button>
                        </div>
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Mac App Shell</h2>
                            <div className="rounded-xl border border-border-subtle bg-bg-app h-[620px] overflow-hidden">
                                <WorkspaceLayout
                                    header={(
                                        <div className="flex h-10 items-center px-3">
                                            <div className="flex items-center gap-1">
                                                <span className="h-3 w-3 rounded-full bg-rose-500/90" />
                                                <span className="h-3 w-3 rounded-full bg-amber-500/90" />
                                                <span className="h-3 w-3 rounded-full bg-emerald-500/90" />
                                            </div>
                                        </div>
                                    )}
                                    sidebar={macAppView === "settings" ? (
                                        <div className="flex h-full flex-col px-2 py-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Settings</div>
                                            <div className="mt-2 flex flex-col gap-1">
                                                {[
                                                    { id: "general", label: "General" },
                                                    { id: "configuration", label: "Configuration" },
                                                    { id: "personalization", label: "Personalization" },
                                                    { id: "mcp", label: "MCP servers" },
                                                    { id: "git", label: "Git" },
                                                    { id: "environments", label: "Environments" },
                                                    { id: "worktrees", label: "Worktrees" },
                                                    { id: "archived", label: "Archived threads" },
                                                ].map((section) => (
                                                    <button
                                                        key={section.id}
                                                        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs ${macSettingsSection === section.id
                                                            ? 'bg-state-selected text-text-primary'
                                                            : 'text-text-secondary hover:bg-state-hover hover:text-text-primary'
                                                            }`}
                                                        onClick={() => setMacSettingsSection(section.id)}
                                                    >
                                                        {section.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => setMacAppView("app")}
                                                className="mt-3 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                            >
                                                Back to app
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex h-full flex-col px-2 py-3">
                                            <Button size="xs" variant="secondary" className="w-full">New thread</Button>
                                            <div className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-text-muted">Threads</div>
                                            <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                                                {sampleThreads.map((thread) => (
                                                    <button
                                                        key={thread.id}
                                                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                                    >
                                                        <span className="truncate">{thread.title}</span>
                                                        <span className="text-[10px] text-text-muted">{thread.meta}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <button className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary">
                                                Settings
                                            </button>
                                        </div>
                                    )}
                                    content={macAppView === "settings" ? (
                                        <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 py-4">
                                            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                                                <section className="space-y-3">
                                                    <h3 className="text-sm font-semibold text-text-primary">General</h3>
                                                    <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                                                        <div className="flex items-center justify-between gap-4 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium text-text-primary">Default open destination</div>
                                                                <div className="text-xs text-text-muted">Where files and folders open by default.</div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Button size="xs" variant="secondary">Workspace</Button>
                                                                <Button size="xs" variant="ghost">System</Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium text-text-primary">Prevent sleep while running</div>
                                                                <div className="text-xs text-text-muted">Keep your computer awake while the agent runs.</div>
                                                            </div>
                                                            <Toggle
                                                                size="sm"
                                                                checked={macSettingsState.preventSleep}
                                                                onChange={(checked) => setMacSettingsState((prev) => ({ ...prev, preventSleep: checked }))}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium text-text-primary">Require ⌘+Enter for long prompts</div>
                                                                <div className="text-xs text-text-muted">Multiline prompts require ⌘+Enter to send.</div>
                                                            </div>
                                                            <Toggle
                                                                size="sm"
                                                                checked={macSettingsState.requireCmdEnter}
                                                                onChange={(checked) => setMacSettingsState((prev) => ({ ...prev, requireCmdEnter: checked }))}
                                                            />
                                                        </div>
                                                    </div>
                                                </section>
                                                <section className="space-y-3">
                                                    <h3 className="text-sm font-semibold text-text-primary">Appearance</h3>
                                                    <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                                                        <div className="flex items-center justify-between gap-4 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium text-text-primary">Theme</div>
                                                                <div className="text-xs text-text-muted">Match your system or pick a look.</div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Button size="xs" variant="ghost">Light</Button>
                                                                <Button size="xs" variant="ghost">Dark</Button>
                                                                <Button size="xs" variant="secondary">System</Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium text-text-primary">Use opaque window background</div>
                                                                <div className="text-xs text-text-muted">Reduce translucency for focus.</div>
                                                            </div>
                                                            <Toggle
                                                                size="sm"
                                                                checked={macSettingsState.opaqueBackground}
                                                                onChange={(checked) => setMacSettingsState((prev) => ({ ...prev, opaqueBackground: checked }))}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium text-text-primary">Use pointer cursors</div>
                                                                <div className="text-xs text-text-muted">Show a pointer over interactive elements.</div>
                                                            </div>
                                                            <Toggle
                                                                size="sm"
                                                                checked={macSettingsState.pointerCursors}
                                                                onChange={(checked) => setMacSettingsState((prev) => ({ ...prev, pointerCursors: checked }))}
                                                            />
                                                        </div>
                                                    </div>
                                                </section>
                                                <section className="space-y-3">
                                                    <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                                                    <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                                                        <div className="flex items-center justify-between gap-4 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium text-text-primary">Turn completion notifications</div>
                                                                <div className="text-xs text-text-muted">Only alert when a run is finished.</div>
                                                            </div>
                                                            <Toggle
                                                                size="sm"
                                                                checked={macSettingsState.completionNotifications}
                                                                onChange={(checked) => setMacSettingsState((prev) => ({ ...prev, completionNotifications: checked }))}
                                                            />
                                                        </div>
                                                    </div>
                                                </section>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-full min-h-0 flex-col border-r border-border-subtle">
                                            <div className="flex-1 overflow-y-auto px-3 py-3">
                                                <div className="space-y-3">
                                                    <div className="border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted">
                                                        Ask anything to start. The agent will update this panel and send edits for approval.
                                                    </div>
                                                    <div className="border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-secondary">
                                                        Agent: “I cleaned up the layout and documented the changes.”
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="border-t border-border-subtle bg-bg-surface px-3 py-3">
                                                <ChatInput
                                                    value={globalDraft}
                                                    onChange={setGlobalDraft}
                                                    placeholder="Ask for follow-up changes"
                                                    onSend={() => setGlobalDraft('')}
                                                    footerLeft={<span className="text-[10px] text-text-muted">Context locked</span>}
                                                />
                                            </div>
                                            <div className="h-[140px] border-t border-border-subtle bg-bg-surface px-3 py-2 font-mono text-[11px] text-text-secondary">
                                                <div className="text-text-muted">$ npm run dev</div>
                                                <div>Running on http://localhost:3000</div>
                                                <div className="text-text-muted">Watching 1 file...</div>
                                                <div>Compiled successfully</div>
                                            </div>
                                        </div>
                                    )}
                                    aside={macAppView === "settings" ? undefined : (
                                        <div className="flex h-full flex-col">
                                            <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                                                <span>Uncommitted changes</span>
                                                <span className="text-[10px] text-text-muted">3</span>
                                            </div>
                                            <div className="space-y-1 border-b border-border-subtle px-2 py-2">
                                                {sampleDiffFiles.slice(0, 3).map((diff) => (
                                                    <div key={diff.id} className="rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="truncate">{diff.filename}</span>
                                                            <span className="text-[10px] text-text-muted">+{diff.additions}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex flex-1 items-center justify-center text-xs text-text-muted">
                                                Diff is too large to display
                                            </div>
                                        </div>
                                    )}
                                    contentClassName="bg-transparent"
                                    sidebarClassName="border-r border-border-subtle bg-bg-app"
                                    asideClassName="border-l border-border-subtle bg-bg-app"
                                    sidebarWidth="w-72"
                                    asideWidth="w-[320px]"
                                />
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== AGENT TAB (NEW v4.0) ========== */}
                {activeTab === "Agent" && (
                    <div className="space-y-12">
                        {/* Thinking Bubbles */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Thinking Bubbles (Cursor-Style)</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Active Thinking</h4>
                                    <ThinkingBubble isActive summary="Analyzing codebase structure..." />
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Completed Thought</h4>
                                    <ThinkingBubble
                                        summary="Identified authentication patterns"
                                        content="Found JWT middleware in /src/middleware/auth.ts. The current implementation uses refresh tokens with a 7-day expiry..."
                                        defaultExpanded
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Tool Logs */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Tool Execution Logs</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Tool Container</h4>
                                    <ToolLog tools={sampleTools} />
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Status Icons</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { status: 'success', icon: CheckCircle2, color: 'text-emerald-400' },
                                            { status: 'running', icon: Loader2, color: 'text-sky-400', spin: true },
                                            { status: 'error', icon: XCircle, color: 'text-rose-400' },
                                        ].map((s) => (
                                            <div key={s.status} className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-800 text-[10px]">
                                                <s.icon className={`w-3 h-3 ${s.color} ${s.spin ? 'animate-spin' : ''}`} />
                                                <span className="text-zinc-300">{s.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Context Chips */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Context Chips</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <h4 className="text-xs font-medium text-text-secondary mb-3">Semantic Variants</h4>
                                <ContextChips
                                    chips={[
                                        createFileChip('auth.ts'),
                                        createFileChip('middleware.ts'),
                                        createAgentChip('Code Review'),
                                        createModelChip('gpt-4o'),
                                        { id: 'folder', label: 'src/components', variant: 'folder' },
                                        { id: 'tag', label: 'security', variant: 'tag' },
                                    ]}
                                    onDismiss={(id) => console.log('dismiss', id)}
                                />
                            </div>
                        </section>

                        {/* Diff Approval */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Diff Approval (Cursor-Style)</h2>
                            <DiffApproval
                                files={sampleDiffFiles}
                                states={diffStates}
                                onApprove={handleApprove}
                                onReject={handleReject}
                                onApproveAll={handleApproveAll}
                                onRejectAll={handleRejectAll}
                                onReset={handleReset}
                            />
                        </section>

                        {/* Inline Completion */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Inline Completion (Ghost Text)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface font-mono text-sm">
                                <div className="flex">
                                    <span className="text-zinc-300">const user = await fetchUser(</span>
                                    <InlineCompletion text="userId, { include: ['profile', 'settings'] })" />
                                </div>
                                <p className="mt-3 text-[10px] text-text-muted">Press Tab to accept • Escape to dismiss</p>
                            </div>
                        </section>
                    </div>
                )}

            </main>

            <footer className="border-t border-border-subtle bg-bg-surface mt-16">
                <div className="max-w-7xl mx-auto px-6 py-6 text-center">
                    <p className="text-xs text-text-muted">🧠 Numezis Design System v4.0 • Custom Mac App Edition • February 2026</p>
                </div>
            </footer>
        </div>
    );
}
