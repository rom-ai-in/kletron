"use client";

import React, { useState } from "react";
import {
    Files, Search, GitBranch, Bug, Brain, Settings, MessageSquare, List,
    Play, Pause, CheckCircle2, XCircle, Clock, Loader2, Send, StopCircle,
    ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, Plus, ArrowUp,
    MoreHorizontal, Wrench, Terminal, Eye, Code2, Check, X, RefreshCw, User, Cpu, BarChart3,
    SplitSquareVertical, Maximize2, Minimize2, AlertCircle, PlayCircle, Archive
} from "lucide-react";

// ============================================================================
// MOCK DATA - Would come from API in production
// ============================================================================

const mockConversations = [
    { id: "1", title: "Add authentication flow", status: "waiting", lastUpdate: "2m ago", pendingEdits: 3 },
    { id: "2", title: "Refactor API routes", status: "working", lastUpdate: "5m ago", pendingEdits: 0 },
    { id: "3", title: "Fix database connection", status: "idle", lastUpdate: "1h ago", pendingEdits: 0 },
    { id: "4", title: "Update dependencies", status: "idle", lastUpdate: "3h ago", pendingEdits: 0 },
];

const mockMessages = [
    { id: "1", role: "user", content: "Add JWT authentication to the API routes" },
    { id: "2", role: "assistant", content: "I'll implement JWT authentication for your API. Let me analyze the current structure first.", thinking: "Analyzing the codebase for existing auth patterns..." },
    { id: "3", role: "tool", name: "read_file", args: "src/app/api/auth/route.ts", status: "success" },
    { id: "4", role: "tool", name: "edit_file", args: "src/middleware.ts", status: "pending" },
    { id: "5", role: "assistant", content: "I've analyzed the codebase and prepared the authentication implementation. I need your approval to apply the following changes:" },
];

const mockPendingEdits = [
    { id: "e1", filename: "middleware.ts", additions: 45, deletions: 0, isNew: false },
    { id: "e2", filename: "lib/jwt.ts", additions: 78, deletions: 0, isNew: true },
    { id: "e3", filename: ".env.local", additions: 3, deletions: 0, isNew: false },
];

const mockFileTree = [
    {
        id: "src", name: "src", type: "folder", expanded: true, children: [
            {
                id: "src/app", name: "app", type: "folder", expanded: true, children: [
                    { id: "src/app/api", name: "api", type: "folder", expanded: false, children: [] },
                    { id: "src/app/page.tsx", name: "page.tsx", type: "file" },
                    { id: "src/app/layout.tsx", name: "layout.tsx", type: "file" },
                ]
            },
            { id: "src/components", name: "components", type: "folder", expanded: false, children: [] },
            { id: "src/lib", name: "lib", type: "folder", expanded: false, children: [] },
        ]
    },
    { id: "package.json", name: "package.json", type: "file" },
    { id: ".env", name: ".env", type: "file" },
];

const mockPlan = [
    { id: "1", step: "Analyze existing auth patterns", status: "completed" },
    { id: "2", step: "Create JWT utility functions", status: "completed" },
    { id: "3", step: "Implement middleware", status: "pending" },
    { id: "4", step: "Update API routes", status: "upcoming" },
    { id: "5", step: "Add refresh token logic", status: "upcoming" },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ActivityBarIcon({ icon: Icon, label, active, badge, onClick }: {
    icon: React.ElementType; label: string; active?: boolean; badge?: number; onClick?: () => void
}) {
    return (
        <div
            className={`relative w-12 h-12 flex items-center justify-center cursor-pointer transition-colors group
                ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            onClick={onClick}
            title={label}
        >
            {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />}
            <Icon className="w-6 h-6" />
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-medium text-white bg-sky-500 rounded-full">
                    {badge}
                </span>
            )}
        </div>
    );
}

function ConversationItem({ conv, active, onClick }: { conv: typeof mockConversations[0]; active: boolean; onClick: () => void }) {
    const statusConfig = {
        waiting: { label: "Waiting", color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/40", icon: AlertCircle },
        working: { label: "Working", color: "text-sky-400", bg: "bg-sky-500/20", border: "border-sky-500/40", icon: PlayCircle },
        idle: { label: "Idle", color: "text-zinc-500", bg: "bg-zinc-700/20", border: "border-zinc-700/40", icon: CheckCircle2 },
    };
    const status = statusConfig[conv.status as keyof typeof statusConfig];
    const StatusIcon = status.icon;

    return (
        <div
            onClick={onClick}
            className={`group p-3 border-b border-zinc-800 cursor-pointer transition-all hover:bg-zinc-800/60
                ${active ? 'bg-sky-500/10 border-l-2 border-l-sky-500' : ''}`}
        >
            <div className="flex items-start justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-zinc-100 truncate pr-4">{conv.title}</span>
                {conv.pendingEdits > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {conv.pendingEdits} pending
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between">
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${status.border} ${status.bg} ${status.color} text-[10px] font-bold uppercase tracking-wider`}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {status.label}
                </span>
                <span className="flex items-center gap-1 text-zinc-500 text-[10px]">
                    <Clock className="w-2.5 h-2.5" />
                    {conv.lastUpdate}
                </span>
            </div>
        </div>
    );
}

function FileTreeItem({ node, depth = 0 }: { node: any; depth?: number }) {
    const [expanded, setExpanded] = useState(node.expanded ?? false);
    const isFolder = node.type === "folder";
    const pl = depth * 12 + 8;

    return (
        <>
            <div
                className="flex items-center gap-1 py-1 text-zinc-300 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                style={{ paddingLeft: pl }}
                onClick={() => isFolder && setExpanded(!expanded)}
            >
                <span className="w-4 h-4 flex items-center justify-center">
                    {isFolder && (expanded ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />)}
                </span>
                <span className="w-4 h-4 flex items-center justify-center">
                    {isFolder
                        ? (expanded ? <FolderOpen className="w-4 h-4 text-amber-400" /> : <Folder className="w-4 h-4 text-amber-400" />)
                        : <FileCode className="w-4 h-4 text-sky-400" />
                    }
                </span>
                <span className="text-xs truncate">{node.name}</span>
            </div>
            {isFolder && expanded && node.children?.map((child: any) => (
                <FileTreeItem key={child.id} node={child} depth={depth + 1} />
            ))}
        </>
    );
}

function PlanStep({ step, index }: { step: typeof mockPlan[0]; index: number }) {
    const statusConfig = {
        completed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/20" },
        pending: { icon: Loader2, color: "text-sky-400", bg: "bg-sky-500/20", spin: true },
        upcoming: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-700/20" },
    };
    const config = statusConfig[step.status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
        <div className="flex items-start gap-2 py-2 px-3 border-b border-zinc-800/50">
            <div className={`w-5 h-5 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-3 h-3 ${config.color} ${(config as any).spin ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
                <span className={`text-xs ${step.status === 'upcoming' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    {index + 1}. {step.step}
                </span>
            </div>
        </div>
    );
}

function ThinkingBubble({ content, isActive }: { content: string; isActive?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
                <Brain className={`w-4 h-4 text-violet-400 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="flex-1 text-xs font-medium text-violet-300">Thinking...</span>
                {isActive && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
                {expanded ? <ChevronDown className="w-3 h-3 text-violet-300" /> : <ChevronRight className="w-3 h-3 text-violet-300" />}
            </button>
            {expanded && (
                <div className="px-3 pb-2 border-t border-violet-500/20 pt-2">
                    <p className="text-[11px] text-violet-300/70">{content}</p>
                </div>
            )}
        </div>
    );
}

function ToolCallItem({ tool }: { tool: typeof mockMessages[2] }) {
    const statusConfig = {
        success: { icon: CheckCircle2, color: "text-emerald-400" },
        pending: { icon: Loader2, color: "text-amber-400", spin: true },
        error: { icon: XCircle, color: "text-rose-400" },
    };
    const config = statusConfig[(tool as any).status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px]">
            <Wrench className="w-3 h-3 text-amber-400" />
            <span className="text-amber-300 font-medium">{(tool as any).name}</span>
            <span className="flex-1 text-zinc-500 truncate">{(tool as any).args}</span>
            <Icon className={`w-3 h-3 ${config.color} ${(config as any).spin ? 'animate-spin' : ''}`} />
        </div>
    );
}

function DiffApprovalCard({ edit, onApprove, onReject }: {
    edit: typeof mockPendingEdits[0];
    onApprove: () => void;
    onReject: () => void
}) {
    return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
                <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-200">{edit.filename}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${edit.isNew ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                        }`}>
                        {edit.isNew ? 'NEW' : `+${edit.additions} -${edit.deletions}`}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={onApprove}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                    >
                        <Check className="w-3 h-3" />
                        Accept
                    </button>
                    <button
                        onClick={onReject}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                    >
                        <X className="w-3 h-3" />
                        Reject
                    </button>
                </div>
            </div>
            {/* Diff preview */}
            <div className="p-3 font-mono text-[11px] leading-relaxed">
                <div className="text-zinc-500">// Preview of changes...</div>
                <div className="text-emerald-400 bg-emerald-500/10 px-1 -mx-1">+ import {"{"} verifyToken {"}"} from &apos;./jwt&apos;;</div>
                <div className="text-emerald-400 bg-emerald-500/10 px-1 -mx-1">+ export const config = {"{"} matcher: [&apos;/api/:path*&apos;] {"}"}</div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN IDE LAYOUT
// ============================================================================

export default function FullIDELayout() {
    const [activeConvId, setActiveConvId] = useState("1");
    const [activePanel, setActivePanel] = useState<"explorer" | "search" | "git" | "debug" | "ai">("ai");
    const [rightPanel, setRightPanel] = useState<"chat" | "runs" | "plan">("chat");
    const [input, setInput] = useState("");
    const [pendingEdits, setPendingEdits] = useState(mockPendingEdits);
    const [isThinking, setIsThinking] = useState(false);

    const handleApprove = (id: string) => {
        setPendingEdits(prev => prev.filter(e => e.id !== id));
    };

    const handleApproveAll = () => {
        setPendingEdits([]);
    };

    return (
        <div className="h-screen flex flex-col bg-[#1e1e1e] text-zinc-300 font-sans overflow-hidden">
            {/* Title Bar */}
            <div className="h-8 flex items-center justify-between px-4 bg-[#323233] border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-300">Numezis Code</span>
                    <span className="text-[10px] text-zinc-500">— numezis-coder-mcp</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Activity Bar */}
                <div className="w-12 flex flex-col items-center bg-[#333333] border-r border-zinc-700">
                    <div className="flex-1 pt-1">
                        <ActivityBarIcon icon={Files} label="Explorer" active={activePanel === "explorer"} onClick={() => setActivePanel("explorer")} />
                        <ActivityBarIcon icon={Search} label="Search" active={activePanel === "search"} onClick={() => setActivePanel("search")} />
                        <ActivityBarIcon icon={GitBranch} label="Source Control" active={activePanel === "git"} onClick={() => setActivePanel("git")} />
                        <ActivityBarIcon icon={Bug} label="Debug" active={activePanel === "debug"} onClick={() => setActivePanel("debug")} />
                        <ActivityBarIcon icon={Brain} label="AI Assistant" active={activePanel === "ai"} badge={pendingEdits.length} onClick={() => setActivePanel("ai")} />
                    </div>
                    <div className="pb-1">
                        <ActivityBarIcon icon={Settings} label="Settings" />
                    </div>
                </div>

                {/* Primary Sidebar (File Explorer / Conversations) */}
                <div className="w-60 flex flex-col bg-[#252526] border-r border-zinc-700">
                    {activePanel === "ai" ? (
                        <>
                            <div className="h-8 flex items-center justify-between px-3 border-b border-zinc-700">
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Agent Runs</span>
                                <button className="p-1 hover:bg-zinc-700 rounded">
                                    <Plus className="w-3.5 h-3.5 text-zinc-400" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-elegant">
                                {mockConversations.map(conv => (
                                    <ConversationItem
                                        key={conv.id}
                                        conv={conv}
                                        active={conv.id === activeConvId}
                                        onClick={() => setActiveConvId(conv.id)}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="h-8 flex items-center px-3 border-b border-zinc-700">
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Explorer</span>
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-elegant py-1">
                                {mockFileTree.map(node => (
                                    <FileTreeItem key={node.id} node={node} />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
                    {/* Editor Tabs */}
                    <div className="h-9 flex items-stretch bg-[#2d2d30] border-b border-[#252526]">
                        <div className="flex items-center gap-2 px-3 bg-[#1e1e1e] border-r border-[#252526] min-w-[120px]">
                            <FileCode className="w-4 h-4 text-sky-400" />
                            <span className="text-xs text-zinc-300">middleware.ts</span>
                            <span className="w-2 h-2 rounded-full bg-amber-400 ml-auto" title="Modified" />
                        </div>
                        <div className="flex items-center gap-2 px-3 border-r border-[#252526] min-w-[100px] text-zinc-500 hover:bg-zinc-800/50 cursor-pointer">
                            <FileCode className="w-4 h-4 text-zinc-500" />
                            <span className="text-xs">jwt.ts</span>
                        </div>
                        <div className="flex-1" />
                    </div>

                    {/* Editor Content - Shows Diff Preview when pending edits */}
                    <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                        {pendingEdits.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-zinc-200">Pending Changes</h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleApproveAll}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            Approve All ({pendingEdits.length})
                                        </button>
                                    </div>
                                </div>
                                {pendingEdits.map(edit => (
                                    <DiffApprovalCard
                                        key={edit.id}
                                        edit={edit}
                                        onApprove={() => handleApprove(edit.id)}
                                        onReject={() => handleApprove(edit.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-zinc-500">
                                <div>1  <span className="text-violet-400">import</span> {"{"} NextResponse {"}"} <span className="text-violet-400">from</span> <span className="text-emerald-400">&apos;next/server&apos;</span></div>
                                <div>2  <span className="text-violet-400">import</span> {"{"} verifyToken {"}"} <span className="text-violet-400">from</span> <span className="text-emerald-400">&apos;./lib/jwt&apos;</span></div>
                                <div>3  </div>
                                <div>4  <span className="text-violet-400">export function</span> <span className="text-sky-400">middleware</span>(request) {"{"}</div>
                                <div>5    <span className="text-zinc-400">// Authentication middleware</span></div>
                                <div>6    <span className="text-violet-400">const</span> token = request.headers.get(<span className="text-emerald-400">&apos;authorization&apos;</span>)</div>
                                <div>7    ...</div>
                                <div>8  {"}"}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Chat / Plan */}
                <div className="w-96 flex flex-col bg-[#252526] border-l border-zinc-700">
                    {/* Panel Tabs */}
                    <div className="h-8 flex items-center gap-1 px-2 border-b border-zinc-700">
                        {[
                            { id: "chat", icon: MessageSquare, label: "Chat" },
                            { id: "runs", icon: List, label: "Tools" },
                            { id: "plan", icon: BarChart3, label: "Plan" },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setRightPanel(tab.id as any)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors
                                    ${rightPanel === tab.id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Chat Panel */}
                    {rightPanel === "chat" && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-elegant">
                                {mockMessages.map(msg => (
                                    <div key={msg.id}>
                                        {msg.role === "user" && (
                                            <div className="rounded-lg p-3 bg-zinc-800/50 border border-zinc-700">
                                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">You</div>
                                                <div className="text-sm text-zinc-200">{msg.content}</div>
                                            </div>
                                        )}
                                        {msg.role === "assistant" && (
                                            <div className="space-y-2">
                                                {(msg as any).thinking && (
                                                    <ThinkingBubble content={(msg as any).thinking} isActive={isThinking} />
                                                )}
                                                <div className="rounded-lg p-3 bg-zinc-800/50 border border-zinc-700">
                                                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Assistant</div>
                                                    <div className="text-sm text-zinc-300">{msg.content}</div>
                                                </div>
                                            </div>
                                        )}
                                        {msg.role === "tool" && (
                                            <ToolCallItem tool={msg} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Input */}
                            <div className="p-3 border-t border-zinc-700">
                                <div className="rounded-2xl border border-zinc-700 p-3 bg-[#3c3c3c]">
                                    <textarea
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        placeholder="Ask anything..."
                                        className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none"
                                        rows={2}
                                    />
                                    <div className="flex items-center justify-between gap-2 mt-2">
                                        <div className="flex gap-1">
                                            <div className="flex items-center gap-1 px-2 h-6 rounded-full border border-zinc-700 bg-zinc-800 text-[11px]">
                                                <BarChart3 className="w-3 h-3 text-zinc-400" />
                                                <span className="text-zinc-300">Agent Mode</span>
                                            </div>
                                            <div className="flex items-center gap-1 px-2 h-6 rounded-full border border-zinc-700 bg-zinc-800 text-[11px]">
                                                <Cpu className="w-3 h-3 text-zinc-400" />
                                                <span className="text-zinc-300">gpt-4o</span>
                                            </div>
                                        </div>
                                        <button className="w-7 h-7 flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 transition-colors">
                                            <ArrowUp className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tools Panel */}
                    {rightPanel === "runs" && (
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-elegant">
                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Tool Executions</div>
                            {mockMessages.filter(m => m.role === "tool").map(tool => (
                                <ToolCallItem key={tool.id} tool={tool} />
                            ))}
                        </div>
                    )}

                    {/* Plan Panel */}
                    {rightPanel === "plan" && (
                        <div className="flex-1 overflow-y-auto scrollbar-elegant">
                            <div className="p-3 border-b border-zinc-700">
                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Current Task</div>
                                <div className="text-sm font-medium text-zinc-200">Add JWT authentication</div>
                            </div>
                            {mockPlan.map((step, i) => (
                                <PlanStep key={step.id} step={step} index={i} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div className="h-[22px] flex items-center justify-between px-2 bg-[#007acc] text-white text-[11px]">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" />
                        main
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> 0
                        </span>
                        <span className="flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> 2
                        </span>
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">🤖 gpt-4o</span>
                    <span>Ln 24, Col 8</span>
                    <span>UTF-8</span>
                    <span>TypeScript React</span>
                </div>
            </div>
        </div>
    );
}
