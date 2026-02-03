"use client";

import React, { useState } from "react";
import {
    Check, AlertCircle, Loader2, ChevronRight, ChevronDown, ChevronLeft, Copy, Settings, User, Zap, FileCode, Play, Pause,
    CheckCircle2, XCircle, Clock, Folder, FolderOpen, File, Terminal, Database, Share2, Layers, Globe, History,
    Edit3, Trash2, MoreHorizontal, Search, Command, Plus, Home, LogOut, X, MessageSquare, List, Menu,
    RefreshCw, ArrowUp, Cpu, BarChart3, Brain, Wrench, FileText, GitBranch, Eye, Code2, CheckCheck, XOctagon, RotateCcw,
    Files, Bug, Users, Shield, BookOpen, Tag, Mail, Bell, Lock, Key
} from "lucide-react";

// Import from central barrel
import {
    // UI Components
    Button,
    Panel,
    Modal,
    Skeleton,
    Selector, type SelectorOption,
    SelectableRow,
    ContextMenu, type ContextMenuEntry,
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
} from "@/src/components/design-system";

const TABS = ["Foundation", "Components", "Patterns", "Portal", "IDE", "Agent"] as const;
type TabType = typeof TABS[number];

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

// ============================================================================
// IDE FULL DEMO DATA
// ============================================================================

const ideMockConversations = [
    { id: "1", title: "Add authentication flow", status: "waiting", lastUpdate: "2m ago", pendingEdits: 3 },
    { id: "2", title: "Refactor API routes", status: "working", lastUpdate: "5m ago", pendingEdits: 0 },
    { id: "3", title: "Fix database connection", status: "idle", lastUpdate: "1h ago", pendingEdits: 0 },
];

const ideMockMessages = [
    { id: "1", role: "user", content: "Add JWT authentication to the API routes" },
    { id: "2", role: "assistant", content: "I'll implement JWT authentication. Let me analyze the structure.", thinking: "Analyzing codebase for auth patterns..." },
    { id: "3", role: "tool", name: "read_file", args: "src/app/api/auth/route.ts", status: "success" },
    { id: "4", role: "tool", name: "edit_file", args: "src/middleware.ts", status: "pending" },
    { id: "5", role: "assistant", content: "I need your approval to apply the changes:" },
];

const ideMockPendingEdits = [
    { id: "e1", filename: "middleware.ts", additions: 45, deletions: 0, isNew: false },
    { id: "e2", filename: "lib/jwt.ts", additions: 78, deletions: 0, isNew: true },
];

const ideMockFileTree = [
    {
        id: "src", name: "src", type: "folder", expanded: true, children: [
            {
                id: "src/app", name: "app", type: "folder", expanded: true, children: [
                    { id: "src/app/api", name: "api", type: "folder", expanded: false, children: [] },
                    { id: "src/app/page.tsx", name: "page.tsx", type: "file" },
                ]
            },
            { id: "src/lib", name: "lib", type: "folder", expanded: false, children: [] },
        ]
    },
    { id: "package.json", name: "package.json", type: "file" },
];

const ideMockPlan = [
    { id: "1", step: "Analyze existing auth patterns", status: "completed" },
    { id: "2", step: "Create JWT utility functions", status: "completed" },
    { id: "3", step: "Implement middleware", status: "pending" },
    { id: "4", step: "Update API routes", status: "upcoming" },
];

// ============================================================================
// IDE FULL DEMO SUB-COMPONENTS
// ============================================================================

type IDETheme = {
    editor: string; sidebar: string; activityBar: string; titleBar: string; tabBar: string;
    panel: string; statusBar: string; tabActive: string; listHover: string; listActive: string;
    border: string; borderSubtle: string; fg: string; fgMuted: string; fgActive: string;
    accent: string; accentHover: string; accentMuted: string; added: string; modified: string; deleted: string;
};

function IDEActivityIcon({ icon: Icon, label, active, badge, onClick, accentColor, badgeColor }: {
    icon: React.ElementType; label: string; active?: boolean; badge?: number; onClick?: () => void;
    accentColor?: string; badgeColor?: string;
}) {
    return (
        <div
            className="relative w-12 h-12 flex items-center justify-center cursor-pointer transition-colors group"
            style={{ color: active ? (accentColor || '#bfbfbf') : '#888888' }}
            onClick={onClick}
            title={label}
        >
            {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r" style={{ background: accentColor || '#bfbfbf' }} />}
            <Icon className="w-6 h-6" />
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-medium text-white rounded-full"
                    style={{ background: badgeColor || '#3994BC' }}>
                    {badge}
                </span>
            )}
        </div>
    );
}

function IDEConversationItem({ conv, active, onClick, theme }: { conv: typeof ideMockConversations[0]; active: boolean; onClick: () => void; theme?: IDETheme }) {
    const t = theme || { border: '#2A2B2C', fg: '#bfbfbf', fgMuted: '#888888', accent: '#3994BC', accentMuted: '#3994BC26', modified: '#e5ba7d', listHover: '#262728' };
    const statusConfig = {
        waiting: { label: "Waiting", color: t.modified, icon: AlertCircle },
        working: { label: "Working", color: t.accent, icon: Play },
        idle: { label: "Idle", color: t.fgMuted, icon: CheckCircle2 },
    };
    const status = statusConfig[conv.status as keyof typeof statusConfig];
    const StatusIcon = status.icon;
    return (
        <div onClick={onClick} className="group p-3 cursor-pointer transition-all"
            style={{ borderBottom: `1px solid ${t.border}`, background: active ? t.accentMuted : 'transparent', borderLeft: active ? `2px solid ${t.accent}` : 'none' }}>
            <div className="flex items-start justify-between mb-1.5">
                <span className="text-[13px] font-semibold truncate pr-4" style={{ color: t.fg }}>{conv.title}</span>
                {conv.pendingEdits > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${t.modified}20`, color: t.modified, border: `1px solid ${t.modified}40` }}>{conv.pendingEdits}</span>}
            </div>
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}>
                    <StatusIcon className="w-2.5 h-2.5" />{status.label}
                </span>
                <span className="flex items-center gap-1 text-[10px]" style={{ color: t.fgMuted }}><Clock className="w-2.5 h-2.5" />{conv.lastUpdate}</span>
            </div>
        </div>
    );
}

function IDEFileTreeItem({ node, depth = 0, theme }: { node: any; depth?: number; theme?: IDETheme }) {
    const t = theme || { fg: '#bfbfbf', fgMuted: '#888888', accent: '#3994BC', modified: '#e5ba7d', listHover: '#262728' };
    const [expanded, setExpanded] = useState(node.expanded ?? false);
    const isFolder = node.type === "folder";
    const pl = depth * 12 + 8;
    return (
        <>
            <div className="flex items-center gap-1 py-1 cursor-pointer transition-colors" style={{ paddingLeft: pl, color: t.fg }}
                onClick={() => isFolder && setExpanded(!expanded)}
                onMouseOver={e => e.currentTarget.style.background = t.listHover}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <span className="w-4 h-4 flex items-center justify-center">{isFolder && (expanded ? <ChevronDown className="w-3 h-3" style={{ color: t.fgMuted }} /> : <ChevronRight className="w-3 h-3" style={{ color: t.fgMuted }} />)}</span>
                <span className="w-4 h-4 flex items-center justify-center">{isFolder ? <Folder className="w-4 h-4" style={{ color: t.modified }} /> : <FileCode className="w-4 h-4" style={{ color: t.accent }} />}</span>
                <span className="text-xs truncate">{node.name}</span>
            </div>
            {isFolder && expanded && node.children?.map((child: any) => <IDEFileTreeItem key={child.id} node={child} depth={depth + 1} theme={theme} />)}
        </>
    );
}

function IDEPlanStep({ step, index, theme }: { step: typeof ideMockPlan[0]; index: number; theme?: IDETheme }) {
    const t = theme || { border: '#2A2B2C', fg: '#bfbfbf', fgMuted: '#888888', accent: '#3994BC', added: '#73c991' };
    const statusConfig = {
        completed: { icon: CheckCircle2, color: t.added },
        pending: { icon: Loader2, color: t.accent, spin: true },
        upcoming: { icon: Clock, color: t.fgMuted },
    };
    const config = statusConfig[step.status as keyof typeof statusConfig];
    const Icon = config.icon;
    return (
        <div className="flex items-start gap-2 py-2 px-3" style={{ borderBottom: `1px solid ${t.border}50` }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${config.color}20` }}>
                <Icon className={`w-3 h-3 ${(config as any).spin ? 'animate-spin' : ''}`} style={{ color: config.color }} />
            </div>
            <span className="text-xs" style={{ color: step.status === 'upcoming' ? t.fgMuted : t.fg }}>{index + 1}. {step.step}</span>
        </div>
    );
}

function IDEThinkingBubbleMini({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 overflow-hidden">
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
                <Brain className="w-4 h-4 text-violet-400" />
                <span className="flex-1 text-xs font-medium text-violet-300">Thinking...</span>
                {expanded ? <ChevronDown className="w-3 h-3 text-violet-300" /> : <ChevronRight className="w-3 h-3 text-violet-300" />}
            </button>
            {expanded && <div className="px-3 pb-2 border-t border-violet-500/20 pt-2"><p className="text-[11px] text-violet-300/70">{content}</p></div>}
        </div>
    );
}

function IDEToolCallItem({ tool, theme }: { tool: typeof ideMockMessages[2]; theme?: IDETheme }) {
    const t = theme || { modified: '#e5ba7d', added: '#73c991', deleted: '#f48771', fgMuted: '#888888' };
    const statusConfig = {
        success: { icon: CheckCircle2, color: t.added },
        pending: { icon: Loader2, color: t.modified, spin: true },
        error: { icon: XCircle, color: t.deleted }
    };
    const config = statusConfig[(tool as any).status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    return (
        <div className="flex items-center gap-2 py-1.5 px-2 rounded text-[10px]" style={{ background: `${t.modified}15`, border: `1px solid ${t.modified}40` }}>
            <Wrench className="w-3 h-3" style={{ color: t.modified }} />
            <span className="font-medium" style={{ color: t.modified }}>{(tool as any).name}</span>
            <span className="flex-1 truncate" style={{ color: t.fgMuted }}>{(tool as any).args}</span>
            <Icon className={`w-3 h-3 ${(config as any).spin ? 'animate-spin' : ''}`} style={{ color: config.color }} />
        </div>
    );
}

function IDEDiffApprovalCard({ edit, onApprove, onReject, theme }: { edit: typeof ideMockPendingEdits[0]; onApprove: () => void; onReject: () => void; theme?: IDETheme }) {
    const t = theme || { border: '#2A2B2C', fg: '#bfbfbf', fgMuted: '#888888', accent: '#3994BC', added: '#73c991', deleted: '#f48771', editor: '#121314' };
    return (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}`, background: t.editor }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${t.border}50` }}>
                <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4" style={{ color: t.fgMuted }} />
                    <span className="text-sm font-medium" style={{ color: t.fg }}>{edit.filename}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: edit.isNew ? `${t.added}20` : `${t.fgMuted}20`, color: edit.isNew ? t.added : t.fgMuted }}>{edit.isNew ? 'NEW' : `+${edit.additions}`}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={onApprove} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors" style={{ background: `${t.added}15`, color: t.added, border: `1px solid ${t.added}40` }}><Check className="w-3 h-3" />Accept</button>
                    <button onClick={onReject} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors" style={{ background: `${t.deleted}15`, color: t.deleted, border: `1px solid ${t.deleted}40` }}><X className="w-3 h-3" />Reject</button>
                </div>
            </div>
            <div className="p-3 font-mono text-[11px] leading-relaxed">
                <div style={{ color: t.fgMuted }}>// Preview...</div>
                <div style={{ color: t.added, background: `${t.added}15` }} className="px-1 -mx-1">+ import {"{"} verifyToken {"}"} from './jwt';</div>
            </div>
        </div>
    );
}

// ============================================================================
// IDE FULL DEMO MAIN COMPONENT
// ============================================================================

function IDEFullDemo() {
    const [activeConvId, setActiveConvId] = useState("1");
    const [activePanel, setActivePanel] = useState<"explorer" | "ai">("ai");
    const [rightPanel, setRightPanel] = useState<"chat" | "runs" | "plan">("chat");
    const [input, setInput] = useState("");
    const [pendingEdits, setPendingEdits] = useState(ideMockPendingEdits);

    const handleApprove = (id: string) => setPendingEdits(prev => prev.filter(e => e.id !== id));
    const handleApproveAll = () => setPendingEdits([]);

    // Theme colors from numezis-code-oss/extensions/theme-2026/themes/2026-dark.json
    const theme = {
        // Core surfaces
        editor: '#121314',
        sidebar: '#191A1B',
        activityBar: '#191A1B',
        titleBar: '#191A1B',
        tabBar: '#191A1B',
        panel: '#191A1B',
        statusBar: '#191A1B',
        // Active states
        tabActive: '#121314',
        listHover: '#262728',
        listActive: '#3994BC55',
        // Borders
        border: '#2A2B2C',
        borderSubtle: '#333536',
        // Text
        fg: '#bfbfbf',
        fgMuted: '#888888',
        fgActive: '#bfbfbf',
        // Accent (Numezis teal)
        accent: '#3994BC',
        accentHover: '#3E9BC4',
        accentMuted: '#3994BC26',
        // Status
        added: '#73c991',
        modified: '#e5ba7d',
        deleted: '#f48771',
    };

    return (
        <div className="rounded-xl overflow-hidden" style={{ height: '700px', background: theme.editor, border: `1px solid ${theme.border}` }}>
            {/* Title Bar - Numezis Code branding */}
            <div className="h-9 flex items-center justify-between px-4" style={{ background: theme.titleBar, borderBottom: `1px solid ${theme.border}` }}>
                <div className="flex items-center gap-3">
                    {/* Numezis Code Logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: theme.accent }}>
                            <Code2 className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm font-semibold" style={{ color: theme.fg }}>Numezis Code</span>
                    </div>
                    <span className="text-[10px]" style={{ color: theme.fgMuted }}>— numezis-coder-mcp</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: `${theme.added}20`, color: theme.added, border: `1px solid ${theme.added}40` }}>Connected</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex" style={{ height: 'calc(100% - 36px - 24px)' }}>
                {/* Activity Bar - VS Code style */}
                <div className="w-12 flex flex-col items-center" style={{ background: theme.activityBar, borderRight: `1px solid ${theme.border}` }}>
                    <div className="flex-1 pt-1">
                        <IDEActivityIcon icon={Files} label="Explorer" active={activePanel === "explorer"} onClick={() => setActivePanel("explorer")} accentColor={theme.fg} />
                        <IDEActivityIcon icon={Search} label="Search" accentColor={theme.fg} />
                        <IDEActivityIcon icon={GitBranch} label="Source Control" accentColor={theme.fg} />
                        <IDEActivityIcon icon={Bug} label="Debug" accentColor={theme.fg} />
                        <IDEActivityIcon icon={Brain} label="AI Assistant" active={activePanel === "ai"} badge={pendingEdits.length} onClick={() => setActivePanel("ai")} accentColor={theme.fg} badgeColor={theme.accent} />
                    </div>
                    <div className="pb-1"><IDEActivityIcon icon={Settings} label="Settings" accentColor={theme.fg} /></div>
                </div>

                {/* Primary Sidebar */}
                <div className="w-60 flex flex-col" style={{ background: theme.sidebar, borderRight: `1px solid ${theme.border}` }}>
                    {activePanel === "ai" ? (
                        <>
                            <div className="h-9 flex items-center justify-between px-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
                                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: theme.fgMuted }}>Agent Runs</span>
                                <button className="p-1 rounded transition-colors" style={{ color: theme.fgMuted }} onMouseOver={e => e.currentTarget.style.background = theme.listHover} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-elegant">
                                {ideMockConversations.map(conv => <IDEConversationItem key={conv.id} conv={conv} active={conv.id === activeConvId} onClick={() => setActiveConvId(conv.id)} theme={theme} />)}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="h-9 flex items-center px-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
                                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: theme.fgMuted }}>Explorer</span>
                            </div>
                            <div className="flex-1 overflow-y-auto py-1">{ideMockFileTree.map(node => <IDEFileTreeItem key={node.id} node={node} theme={theme} />)}</div>
                        </>
                    )}
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-w-0" style={{ background: theme.editor }}>
                    {/* Tab Bar */}
                    <div className="h-9 flex items-stretch" style={{ background: theme.tabBar, borderBottom: `1px solid ${theme.border}` }}>
                        <div className="flex items-center gap-2 px-3 min-w-[140px]" style={{ background: theme.tabActive, borderTop: `2px solid ${theme.accent}`, borderRight: `1px solid ${theme.border}` }}>
                            <FileCode className="w-4 h-4" style={{ color: theme.accent }} />
                            <span className="text-xs" style={{ color: theme.fg }}>middleware.ts</span>
                            <span className="w-2 h-2 rounded-full ml-auto" style={{ background: theme.modified }} />
                        </div>
                        <div className="flex-1" />
                    </div>

                    {/* Editor Content */}
                    <div className="flex-1 overflow-auto p-4 font-mono text-sm" style={{ color: theme.fg }}>
                        {pendingEdits.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold" style={{ color: theme.fg }}>Pending Changes</h2>
                                    <button onClick={handleApproveAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={{ background: `${theme.added}15`, color: theme.added, border: `1px solid ${theme.added}40` }}>
                                        <Check className="w-3.5 h-3.5" />Approve All ({pendingEdits.length})
                                    </button>
                                </div>
                                {pendingEdits.map(edit => <IDEDiffApprovalCard key={edit.id} edit={edit} onApprove={() => handleApprove(edit.id)} onReject={() => handleApprove(edit.id)} theme={theme} />)}
                            </div>
                        ) : (
                            <div style={{ color: theme.fgMuted }}>
                                <div><span style={{ color: '#858889' }}>1  </span><span style={{ color: '#4F8FDD' }}>import</span> {"{"} NextResponse {"}"} <span style={{ color: '#4F8FDD' }}>from</span> <span style={{ color: '#C48081' }}>'next/server'</span></div>
                                <div><span style={{ color: '#858889' }}>2  </span><span style={{ color: '#4F8FDD' }}>import</span> {"{"} verifyToken {"}"} <span style={{ color: '#4F8FDD' }}>from</span> <span style={{ color: '#C48081' }}>'./lib/jwt'</span></div>
                                <div><span style={{ color: '#858889' }}>3  </span></div>
                                <div><span style={{ color: '#858889' }}>4  </span><span style={{ color: '#4F8FDD' }}>export function</span> <span style={{ color: '#D1D6AE' }}>middleware</span>(request) {"{"}</div>
                                <div><span style={{ color: '#858889' }}>5  </span>  <span style={{ color: '#6F9B60' }}>// Authentication middleware</span></div>
                                <div><span style={{ color: '#858889' }}>6  </span>{"}"}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Agent Chat */}
                <div className="w-80 flex flex-col" style={{ background: theme.sidebar, borderLeft: `1px solid ${theme.border}` }}>
                    <div className="h-9 flex items-center gap-1 px-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
                        {[{ id: "chat", icon: MessageSquare, label: "Chat" }, { id: "runs", icon: List, label: "Tools" }, { id: "plan", icon: BarChart3, label: "Plan" }].map(tab => (
                            <button key={tab.id} onClick={() => setRightPanel(tab.id as any)} className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors"
                                style={{ background: rightPanel === tab.id ? theme.accentMuted : 'transparent', color: rightPanel === tab.id ? theme.fg : theme.fgMuted }}>
                                <tab.icon className="w-3.5 h-3.5" />{tab.label}
                            </button>
                        ))}
                    </div>

                    {rightPanel === "chat" && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-elegant">
                                {ideMockMessages.map(msg => (
                                    <div key={msg.id}>
                                        {msg.role === "user" && <div className="rounded-lg p-3" style={{ background: theme.listHover, border: `1px solid ${theme.border}` }}><div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.fgMuted }}>You</div><div className="text-sm" style={{ color: theme.fg }}>{msg.content}</div></div>}
                                        {msg.role === "assistant" && <div className="space-y-2">{(msg as any).thinking && <IDEThinkingBubbleMini content={(msg as any).thinking} />}<div className="rounded-lg p-3" style={{ background: theme.listHover, border: `1px solid ${theme.border}` }}><div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.fgMuted }}>Assistant</div><div className="text-sm" style={{ color: theme.fg }}>{msg.content}</div></div></div>}
                                        {msg.role === "tool" && <IDEToolCallItem tool={msg} theme={theme} />}
                                    </div>
                                ))}
                            </div>
                            <div className="p-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                                <div className="rounded-2xl p-3" style={{ background: theme.panel, border: `1px solid ${theme.borderSubtle}` }}>
                                    <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Ask anything..." className="w-full bg-transparent text-sm resize-none focus:outline-none" style={{ color: theme.fg }} rows={2} />
                                    <div className="flex items-center justify-between gap-2 mt-2">
                                        <div className="flex gap-1.5">
                                            <div className="flex items-center gap-1 px-2 h-6 rounded-full text-[11px] cursor-pointer hover:border-opacity-80 transition-colors" style={{ background: theme.listHover, border: `1px solid ${theme.borderSubtle}`, color: theme.fg }}>
                                                <Share2 className="w-3 h-3" style={{ color: theme.accent }} />Code Reviewer
                                            </div>
                                            <div className="flex items-center gap-1 px-2 h-6 rounded-full text-[11px] cursor-pointer hover:border-opacity-80 transition-colors" style={{ background: theme.listHover, border: `1px solid ${theme.borderSubtle}`, color: theme.fg }}>
                                                <Cpu className="w-3 h-3" style={{ color: theme.fgMuted }} />gpt-4o
                                            </div>
                                        </div>
                                        <button className="w-7 h-7 flex items-center justify-center rounded-full transition-colors" style={{ background: theme.accent }}>
                                            <ArrowUp className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {rightPanel === "runs" && <div className="flex-1 overflow-y-auto p-3 space-y-2"><div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.fgMuted }}>Tool Executions</div>{ideMockMessages.filter(m => m.role === "tool").map(tool => <IDEToolCallItem key={tool.id} tool={tool} theme={theme} />)}</div>}

                    {rightPanel === "plan" && <div className="flex-1 overflow-y-auto"><div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}><div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.fgMuted }}>Current Task</div><div className="text-sm font-medium" style={{ color: theme.fg }}>Add JWT authentication</div></div>{ideMockPlan.map((step, i) => <IDEPlanStep key={step.id} step={step} index={i} theme={theme} />)}</div>}
                </div>
            </div>

            {/* Status Bar - Numezis accent style (not default VS Code blue) */}
            <div className="h-6 flex items-center justify-between px-2 text-[11px]" style={{ background: theme.statusBar, color: theme.fgMuted, borderTop: `1px solid ${theme.border}` }}>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors" style={{ color: '#fff', background: theme.accent }}><Code2 className="w-3 h-3" /> Numezis</span>
                    <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" />main</span>
                    <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />0</span>
                    <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" style={{ color: theme.modified }} />2</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: `${theme.accent}20`, color: theme.accent }}>🤖 gpt-4o</span>
                    <span>Ln 24, Col 8</span>
                    <span>UTF-8</span>
                    <span>TypeScript</span>
                </div>
            </div>
        </div>
    );
}

// Sample data for Portal demos
const sampleNavItems = [
    { label: "Editor", icon: FileCode, href: "/app/workbench" },
    { label: "Deep Agent", icon: Terminal, href: "/app/deep-agent" },
    { label: "Campaigns", icon: Layers, href: "/app/campaigns" },
    { label: "Agent Graphs", icon: Share2, href: "/app/agent-graphs" },
    { label: "Vector Index", icon: Database, href: "/app/vectors" },
    { label: "Configuration", icon: Settings, href: "/app/config" },
];

const sampleSelectorOptions: SelectorOption[] = [
    { id: 'gpt-4o', label: 'GPT-4o', sub: 'OpenAI flagship model' },
    { id: 'claude-3.5', label: 'Claude 3.5 Sonnet', sub: 'Anthropic latest' },
    { id: 'gemini-pro', label: 'Gemini Pro', sub: 'Google DeepMind' },
    { id: 'local', label: 'LM Studio', sub: 'Local inference' },
];

const sampleBreadcrumbs = [
    { label: "App", href: "/app" },
    { label: "Agent Graphs", href: "/app/agent-graphs" },
    { label: "Code Reviewer", href: "/app/agent-graphs/code-reviewer" },
];

const sampleListItems = [
    { id: '1', label: 'Code Reviewer', subLabel: '5 stages · Updated 2h ago', status: 'active' as const },
    { id: '2', label: 'Security Audit', subLabel: '3 stages · Updated 1d ago', status: 'completed' as const },
    { id: '3', label: 'Documentation Gen', subLabel: '4 stages · Updated 3d ago', status: 'pending' as const },
];

const sampleContextMenuItems: ContextMenuEntry[] = [
    { label: 'Edit', icon: <Edit3 className="w-3.5 h-3.5" />, onClick: () => console.log('Edit') },
    { label: 'Duplicate', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => console.log('Duplicate') },
    { label: 'Move to...', icon: <Folder className="w-3.5 h-3.5" />, onClick: () => console.log('Move') },
    { type: 'separator' },
    { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => console.log('Delete'), danger: true },
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

    // Portal demo states
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gpt-4o');
    const [activeNavItem, setActiveNavItem] = useState('/app/workbench');
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [selectedListItem, setSelectedListItem] = useState('1');

    const handleApprove = (id: string) => setDiffStates(prev => ({ ...prev, [id]: 'approved' }));
    const handleReject = (id: string) => setDiffStates(prev => ({ ...prev, [id]: 'rejected' }));
    const handleApproveAll = () => setDiffStates({ 'diff-1': 'approved', 'diff-2': 'approved', 'diff-3': 'approved' });
    const handleRejectAll = () => setDiffStates({ 'diff-1': 'rejected', 'diff-2': 'rejected', 'diff-3': 'rejected' });
    const handleReset = () => setDiffStates({ 'diff-1': 'pending', 'diff-2': 'pending', 'diff-3': 'pending' });

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
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs">Fork Ready</span>
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
                                    <h3 className="text-sm font-medium text-text-secondary">IDE Colors (v4.0)</h3>
                                    <div className="space-y-2">
                                        {[
                                            { name: "--sidebar-bg", hex: "#1e1e1e", desc: "Sidebar" },
                                            { name: "--activitybar-bg", hex: "#333333", desc: "Activity Bar" },
                                            { name: "--statusbar-bg", hex: "#007acc", desc: "Status Bar" },
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

                {/* ========== PORTAL TAB (App Components) ========== */}
                {activeTab === "Portal" && (
                    <div className="space-y-12">
                        {/* App Layout Overview */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">App Layout Architecture</h2>
                            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                                <p className="text-sm text-emerald-200">
                                    The authenticated <code className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs">/app/*</code> section uses a consistent shell with Sidebar, Header, and Breadcrumbs.
                                    These components work together to create a unified navigation experience.
                                </p>
                            </div>
                            {/* Mini App Layout */}
                            <div className="rounded-xl border border-border-subtle overflow-hidden h-[350px] flex bg-bg-app">
                                {/* Mini Sidebar */}
                                <aside className={`flex flex-col border-r border-border-subtle bg-bg-surface transition-all duration-300 ${sidebarCollapsed ? 'w-[56px]' : 'w-56'}`}>
                                    {/* Sidebar Header */}
                                    <div className={`flex items-center gap-3 border-b border-border-subtle py-3 ${sidebarCollapsed ? 'flex-col justify-center px-2' : 'px-4'}`}>
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-text-primary text-bg-surface text-sm">🧠</span>
                                        {!sidebarCollapsed && <span className="text-sm font-semibold text-text-primary">Numezis Code</span>}
                                        <button
                                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                            className={`p-1 rounded text-text-muted hover:bg-state-hover ${sidebarCollapsed ? '' : 'ml-auto'}`}
                                        >
                                            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                    {/* Nav Items */}
                                    <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                                        {!sidebarCollapsed && <div className="mb-2 px-2 text-[9px] font-bold uppercase tracking-widest text-text-muted">Main Menu</div>}
                                        {sampleNavItems.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = activeNavItem === item.href;
                                            return (
                                                <button
                                                    key={item.href}
                                                    onClick={() => setActiveNavItem(item.href)}
                                                    className={`group flex items-center rounded-md px-2 py-1.5 text-xs font-medium w-full transition-colors ${isActive ? 'bg-state-selected text-text-primary' : 'text-text-secondary hover:bg-state-hover'
                                                        } ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}
                                                    title={sidebarCollapsed ? item.label : undefined}
                                                >
                                                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-text-primary' : 'text-text-muted group-hover:text-text-primary'}`} />
                                                    {!sidebarCollapsed && <span>{item.label}</span>}
                                                </button>
                                            );
                                        })}
                                    </nav>
                                    {/* User Profile (Mini) */}
                                    {!sidebarCollapsed && (
                                        <div className="border-t border-border-subtle p-3">
                                            <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-bg-elevated p-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-medium text-text-primary truncate">Developer</p>
                                                    <p className="text-[9px] text-text-muted truncate">dev@numezis.ch</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </aside>
                                {/* Main Content */}
                                <main className="flex-1 flex flex-col min-w-0">
                                    {/* Header with Breadcrumbs */}
                                    <header className="border-b border-border-subtle bg-bg-surface px-4 py-2 flex items-center justify-between">
                                        <nav className="flex items-center gap-1 text-xs text-text-muted">
                                            {sampleBreadcrumbs.map((crumb, idx) => (
                                                <span key={crumb.href} className="flex items-center gap-1">
                                                    <span className={`px-1 py-0.5 rounded transition ${idx === sampleBreadcrumbs.length - 1 ? 'text-text-primary' : 'hover:bg-state-hover hover:text-text-primary cursor-pointer'}`}>
                                                        {crumb.label}
                                                    </span>
                                                    {idx < sampleBreadcrumbs.length - 1 && <span className="text-text-muted">/</span>}
                                                </span>
                                            ))}
                                        </nav>
                                        <div className="flex items-center gap-1.5">
                                            <button className="p-1.5 rounded text-text-muted hover:bg-state-hover">
                                                <History className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </header>
                                    {/* Content Area */}
                                    <div className="flex-1 p-4 overflow-auto">
                                        <div className="text-center py-8 text-text-muted">
                                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
                                                <Share2 className="w-5 h-5" />
                                            </div>
                                            <p className="text-xs">Content area for: <strong className="text-text-primary">{sampleNavItems.find(n => n.href === activeNavItem)?.label}</strong></p>
                                        </div>
                                    </div>
                                </main>
                            </div>
                        </section>

                        {/* Navigation Components */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Navigation Components</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Breadcrumbs */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Breadcrumbs</h4>
                                    <div className="space-y-3">
                                        <nav className="flex items-center gap-1 text-xs text-text-muted">
                                            {['Home', 'Settings', 'Security', 'API Keys'].map((crumb, idx, arr) => (
                                                <span key={crumb} className="flex items-center gap-1">
                                                    <span className={`px-1 py-0.5 rounded transition ${idx === arr.length - 1 ? 'text-text-primary' : 'hover:bg-state-hover cursor-pointer'}`}>
                                                        {crumb}
                                                    </span>
                                                    {idx < arr.length - 1 && <span>/</span>}
                                                </span>
                                            ))}
                                        </nav>
                                        <p className="text-[10px] text-text-muted">Clickable path navigation with active state on last item</p>
                                    </div>
                                </div>
                                {/* Menu Highlight States */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Menu States</h4>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-state-selected text-text-primary text-xs">
                                            <FileCode className="w-3.5 h-3.5" /> Active Item
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-text-secondary hover:bg-state-hover text-xs cursor-pointer transition-colors">
                                            <Terminal className="w-3.5 h-3.5 text-text-muted" /> Hover State
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-text-muted text-xs opacity-50 cursor-not-allowed">
                                            <Shield className="w-3.5 h-3.5" /> Disabled Item
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Form Components */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Form Components</h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {/* Selector - Premium Dropdown */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Selector (Premium Dropdown)</h4>
                                    <div className="space-y-3">
                                        <Selector
                                            label="MODEL"
                                            value={selectedModel}
                                            options={sampleSelectorOptions}
                                            onSelect={setSelectedModel}
                                            direction="down"
                                            status="success"
                                        />
                                        <Selector
                                            label="MODE"
                                            value="gpt-4o"
                                            options={[
                                                { id: 'agent', label: 'Agent' },
                                                { id: 'chat', label: 'Chat' },
                                                { id: 'ask', label: 'Ask' },
                                            ]}
                                            onSelect={() => { }}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                                {/* Text Inputs */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Text Inputs</h4>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Default input..."
                                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-border-strong transition-colors"
                                        />
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                                            <input
                                                type="text"
                                                placeholder="Search with icon..."
                                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value="Read-only value"
                                            readOnly
                                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-app text-sm text-text-muted cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                {/* Textarea */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Textarea</h4>
                                    <textarea
                                        placeholder="Multi-line input..."
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring resize-none"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* List Components */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">List & Row Components</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* SelectableRow */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">SelectableRow</h4>
                                    <div className="space-y-1">
                                        {sampleListItems.map((item) => (
                                            <SelectableRow
                                                key={item.id}
                                                isActive={selectedListItem === item.id}
                                                onClick={() => setSelectedListItem(item.id)}
                                                label={item.label}
                                                subLabel={item.subLabel}
                                                rightElement={
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border uppercase font-bold ${item.status === 'active' ? 'text-sky-400 border-sky-500/40' :
                                                        item.status === 'completed' ? 'text-emerald-400 border-emerald-500/40' :
                                                            'text-amber-400 border-amber-500/40'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                                {/* Context Menu Demo */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Context Menu</h4>
                                    <p className="text-[10px] text-text-muted mb-3">Right-click on the area below to see the context menu</p>
                                    <div
                                        className="h-24 rounded-lg border border-dashed border-border-strong bg-bg-elevated flex items-center justify-center text-text-muted text-xs cursor-context-menu"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenuPos({ x: e.clientX, y: e.clientY });
                                            setContextMenuVisible(true);
                                        }}
                                    >
                                        Right-click here
                                    </div>
                                    {contextMenuVisible && (
                                        <ContextMenu
                                            x={contextMenuPos.x}
                                            y={contextMenuPos.y}
                                            items={sampleContextMenuItems}
                                            onClose={() => setContextMenuVisible(false)}
                                        />
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Panel Variants */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Panel Variants</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <Panel title="Default Panel" headerAction={<Button size="xs">Action</Button>}>
                                    <div className="p-3 text-xs text-text-secondary">Standard surface background</div>
                                </Panel>
                                <Panel title="Elevated Panel" variant="elevated" headerAction={<Button size="xs" variant="ghost"><Settings className="w-3 h-3" /></Button>}>
                                    <div className="p-3 text-xs text-text-secondary">Raised with shadow</div>
                                </Panel>
                                <Panel title="Outlined Panel" variant="outlined">
                                    <div className="p-3 text-xs text-text-secondary">Strong border emphasis</div>
                                </Panel>
                            </div>
                        </section>

                        {/* Tags & Chips */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Tags & Chips</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <h4 className="text-xs font-medium text-text-secondary mb-3">Removable Tags</h4>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { label: 'security', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                                        { label: 'performance', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
                                        { label: 'documentation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                                        { label: 'refactoring', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
                                    ].map((tag) => (
                                        <span key={tag.label} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium ${tag.color}`}>
                                            <Tag className="w-2.5 h-2.5" />
                                            {tag.label}
                                            <button className="hover:bg-white/10 rounded p-0.5">
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Action Bars */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Action Bars</h2>
                            <div className="space-y-4">
                                {/* Header Action Bar */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Header Action Bar</h4>
                                    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border-subtle bg-bg-elevated">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-sm font-medium text-text-primary">Agent Graphs</h3>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">12 Items</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="xs" variant="ghost"><RefreshCw className="w-3 h-3" /></Button>
                                            <Button size="xs"><Plus className="w-3 h-3 mr-1" />New</Button>
                                        </div>
                                    </div>
                                </div>
                                {/* Footer Action Bar */}
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Footer Action Bar</h4>
                                    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border-t border-border-subtle bg-bg-elevated">
                                        <p className="text-xs text-text-muted">3 items selected</p>
                                        <div className="flex items-center gap-2">
                                            <Button size="xs" variant="ghost">Cancel</Button>
                                            <Button size="xs" variant="danger"><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                                            <Button size="xs"><Check className="w-3 h-3 mr-1" />Confirm</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Loading & Progress */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Loading & Progress</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Skeleton Loading</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="w-8 h-8 rounded-full" />
                                            <div className="flex-1 space-y-1.5">
                                                <Skeleton width="w-32" height="h-3" />
                                                <Skeleton width="w-24" height="h-2" />
                                            </div>
                                        </div>
                                        <Skeleton width="w-full" height="h-3" />
                                        <Skeleton width="w-4/5" height="h-3" />
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Progress Indicators</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-[10px] text-text-muted mb-1">
                                                <span>Processing...</span>
                                                <span>67%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                                                <div className="h-full w-2/3 rounded-full bg-sky-500 transition-all" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                                            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                                            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Notifications & Alerts */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Notifications & Alerts</h2>
                            <div className="space-y-3">
                                {[
                                    { type: 'info', icon: AlertCircle, color: 'border-sky-500/30 bg-sky-500/10', iconColor: 'text-sky-400', title: 'Information', message: 'Your session will expire in 15 minutes.' },
                                    { type: 'success', icon: CheckCircle2, color: 'border-emerald-500/30 bg-emerald-500/10', iconColor: 'text-emerald-400', title: 'Success', message: 'Agent graph deployed successfully.' },
                                    { type: 'warning', icon: AlertCircle, color: 'border-amber-500/30 bg-amber-500/10', iconColor: 'text-amber-400', title: 'Warning', message: 'API rate limit approaching. 95% of quota used.' },
                                    { type: 'error', icon: XCircle, color: 'border-rose-500/30 bg-rose-500/10', iconColor: 'text-rose-400', title: 'Error', message: 'Failed to connect to the database. Check your credentials.' },
                                ].map((alert) => (
                                    <div key={alert.type} className={`flex items-start gap-3 p-4 rounded-lg border ${alert.color}`}>
                                        <alert.icon className={`w-5 h-5 shrink-0 ${alert.iconColor}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-text-primary">{alert.title}</p>
                                            <p className="text-xs text-text-secondary mt-0.5">{alert.message}</p>
                                        </div>
                                        <button className="p-1 rounded hover:bg-white/10">
                                            <X className="w-3.5 h-3.5 text-text-muted" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
                {activeTab === "IDE" && (
                    <IDEFullDemo />
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
                    <p className="text-xs text-text-muted">🧠 Numezis Design System v4.0 • Fork Ready Edition • February 2026</p>
                </div>
            </footer>
        </div>
    );
}
