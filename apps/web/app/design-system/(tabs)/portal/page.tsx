"use client";

import { useState } from "react";
import {
    Bot,
    User,
    Terminal,
    Brain,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    ChevronDown,
    ChevronRight,
    Maximize2,
    Wrench,
    AlertTriangle,
    Zap,
    Play,
    Pause,
    FileCode,
    Settings2,
} from "lucide-react";

import {
    Button,
    Selector,
    ChatInput,
    ThreadFeed,
    ToolUsePanel,
    SettingsPanel,
    Switch,
    Badge,
    CodeBlock,
    ToolOutput,
    ThoughtsPanel,
    DiffApproval,
    TokenUsageDisplay,
    DurationDisplay,
    WorkspaceLayout,
    MarkdownRenderer,
    ToolInvocation,
    MessageBubble as SharedMessageBubble,
    SystemMessage,
    type SelectorOption,
    type DiffFile,
    type DiffState,
} from "@numezis/ui/components/design-system";

import { DocCard, DocCode, DocRules, DocSection } from "../../components/DocBlocks";
import { InspectButton } from "../../components/Inspector";
import { componentDocs } from "../../docs";

// ─── Sample Data ─────────────────────────────────────────────────────────────

const sampleSelectorOptions: SelectorOption[] = [
    { id: "gpt-4o", label: "GPT-4o", sub: "OpenAI flagship model" },
    { id: "claude-3.5", label: "Claude 3.5 Sonnet", sub: "Anthropic latest" },
    { id: "gemini-pro", label: "Gemini Pro", sub: "Google DeepMind" },
    { id: "local", label: "LM Studio", sub: "Local inference" },
];

const sampleThreads = [
    { id: "thread-1", title: "Explore workspace", subtitle: "Awaiting response", meta: "2m ago", status: "waiting" as const, badge: "3" },
    { id: "thread-2", title: "Refactor auth flow", subtitle: "Agent replied", meta: "14m ago", status: "active" as const },
    { id: "thread-3", title: "Fix failing tests", subtitle: "Idle", meta: "1h ago", status: "idle" as const },
    { id: "thread-4", title: "Summarize repo", subtitle: "Idle", meta: "3h ago", status: "idle" as const },
    { id: "thread-5", title: "Vector index cleanup", subtitle: "Awaiting response", meta: "Yesterday", status: "waiting" as const },
    { id: "thread-6", title: "Upgrade dependencies", subtitle: "Idle", meta: "Jan 31", status: "idle" as const },
    { id: "thread-7", title: "Design system audit", subtitle: "Agent replied", meta: "Jan 29", status: "active" as const },
];

const sampleToolUse = [
    { id: "tool-1", name: "read_file", detail: "apps/web/app/app/explore/page.tsx", status: "success" as const, meta: "120ms" },
    { id: "tool-2", name: "edit_file", detail: "packages/ui/src/components/Agent/ActiveSession.tsx", status: "running" as const, meta: "2s" },
    { id: "tool-3", name: "run_command", detail: "npm run test", status: "error" as const, meta: "failed" },
    { id: "tool-4", name: "search", detail: "design system updates", status: "pending" as const },
];

const sampleDiffFiles: DiffFile[] = [
    {
        id: "diff-1",
        filename: "ActiveSession.tsx",
        filepath: "packages/ui/src/components/Agent/ActiveSession.tsx",
        additions: 12,
        deletions: 3,
        hunks: [{
            oldStart: 45, newStart: 45,
            lines: [
                { type: "context", content: "  const [messages, setMessages] = useState<Message[]>([]);", oldLineNumber: 45, newLineNumber: 45 },
                { type: "remove", content: "  const [isStreaming, setIsStreaming] = useState(false);", oldLineNumber: 46 },
                { type: "add", content: "  const [isStreaming, setIsStreaming] = useState<boolean>(false);", newLineNumber: 46 },
                { type: "add", content: "  const [streamId, setStreamId] = useState<string | null>(null);", newLineNumber: 47 },
                { type: "context", content: "  const messagesEndRef = useRef<HTMLDivElement>(null);", oldLineNumber: 47, newLineNumber: 48 },
            ],
        }],
    },
    {
        id: "diff-2",
        filename: "ThoughtsPanel.tsx",
        filepath: "packages/ui/src/components/Agent/ThoughtsPanel.tsx",
        additions: 5,
        deletions: 0,
        isNew: true,
    },
    {
        id: "diff-3",
        filename: "deprecated-helper.ts",
        filepath: "packages/shared/src/deprecated-helper.ts",
        additions: 0,
        deletions: 42,
        isDeleted: true,
    },
];

const sampleThoughts = [
    "Analyzing the project structure and identifying key components...",
    "Found 23 files matching the search pattern across 5 directories.",
    "Checking for circular dependencies in the module graph.",
    "The auth module has a potential race condition in the refresh flow.",
    "Generating fix recommendations with severity ratings.",
];

const sampleTokenUsage = {
    totalInputTokens: 12400,
    totalOutputTokens: 3800,
    totalTokens: 16200,
    callCount: 8,
    model: "gpt-4o",
};

// ─── Helper: Message Bubble ──────────────────────────────────────────────────

function MessageBubble({ role, content, toolName, thoughts, isStreaming }: {
    role: "user" | "assistant" | "tool";
    content: string;
    toolName?: string;
    thoughts?: string[];
    isStreaming?: boolean;
}) {
    const isUser = role === "user";
    const isTool = role === "tool";

    return (
        <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold
                ${isUser
                    ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                    : isTool
                        ? "bg-[var(--agent-tool-bg)] text-[var(--agent-tool)]"
                        : "bg-[var(--agent-thinking-bg)] text-[var(--agent-thinking)]"
                }`}>
                {isUser ? <User size={14} /> : isTool ? <Terminal size={14} /> : <Bot size={14} />}
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 space-y-1.5 ${isUser ? "text-right" : ""}`}>
                {/* Role label */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                        {isTool ? toolName ?? "Tool" : role}
                    </span>
                    {isStreaming && <Loader2 size={10} className="animate-spin text-[var(--agent-thinking)]" />}
                </div>

                {/* Thoughts (before content for assistant) */}
                {thoughts && thoughts.length > 0 && (
                    <ThoughtsPanel thoughts={thoughts} isReasoning />
                )}

                {/* Message bubble */}
                <div className={`inline-block rounded-lg px-3 py-2 text-[12px] leading-relaxed max-w-[85%]
                    ${isUser
                        ? "bg-[var(--brand-primary)]/10 text-text-primary border border-[var(--brand-primary)]/20 ml-auto"
                        : isTool
                            ? "bg-[var(--agent-tool-bg)] text-text-secondary border border-[var(--agent-tool-border)] font-mono text-[11px]"
                            : "bg-bg-surface text-text-primary border border-border-subtle"
                    }`}>
                    {content}
                    {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-text-primary/60 animate-pulse ml-0.5 rounded-sm" />}
                </div>
            </div>
        </div>
    );
}

// ─── Helper: Event Card (Deep Agent) ─────────────────────────────────────────

type EventKind = "system" | "user" | "assistant" | "tool";

function EventCard({ kind, content, meta, toolName, isExpanded: defaultExpanded = false }: {
    kind: EventKind;
    content: string;
    meta?: string;
    toolName?: string;
    isExpanded?: boolean;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    const kindConfig: Record<EventKind, { icon: React.ReactNode; label: string; border: string; bg: string; badge: string }> = {
        system: {
            icon: <Settings2 size={12} />,
            label: "System",
            border: "border-zinc-700",
            bg: "bg-zinc-900/50",
            badge: "bg-zinc-700 text-zinc-300",
        },
        user: {
            icon: <User size={12} />,
            label: "User",
            border: "border-[var(--brand-primary)]/20",
            bg: "bg-[var(--brand-primary)]/5",
            badge: "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]",
        },
        assistant: {
            icon: <Bot size={12} />,
            label: "Assistant",
            border: "border-[var(--agent-thinking-border)]",
            bg: "bg-[var(--agent-thinking-bg)]",
            badge: "bg-[var(--agent-thinking-bg)] text-[var(--agent-thinking)]",
        },
        tool: {
            icon: <Wrench size={12} />,
            label: toolName ?? "Tool",
            border: "border-[var(--agent-tool-border)]",
            bg: "bg-[var(--agent-tool-bg)]",
            badge: "bg-[var(--agent-tool-bg)] text-[var(--agent-tool)]",
        },
    };

    const config = kindConfig[kind];
    const isLong = content.length > 200;

    return (
        <div className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden transition-colors`}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-state-hover/30 transition-colors"
                onClick={() => isLong && setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${config.badge}`}>
                        {config.icon}
                        {config.label}
                    </span>
                    {!expanded && isLong && (
                        <span className="text-[11px] text-text-muted truncate max-w-[300px]">
                            {content.slice(0, 80)}...
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {meta && <span className="text-[10px] text-text-muted font-mono">{meta}</span>}
                    {isLong && (
                        <button className="p-0.5 rounded hover:bg-state-hover text-text-muted">
                            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    )}
                    <button className="p-0.5 rounded hover:bg-state-hover text-text-muted">
                        <Maximize2 size={10} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {(expanded || !isLong) && (
                <div className="px-3 pb-3 text-[12px] text-text-secondary leading-relaxed border-t border-border-subtle/50 pt-2">
                    {kind === "tool" ? (
                        <pre className="font-mono text-[11px] whitespace-pre-wrap break-all">{content}</pre>
                    ) : (
                        content
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Helper: Phase Timeline Item ─────────────────────────────────────────────

type PhaseStatus = "pending" | "running" | "success" | "error";

function PhaseItem({ name, status, duration, tokens, isSelected, onClick }: {
    name: string;
    status: PhaseStatus;
    duration?: string;
    tokens?: number;
    isSelected?: boolean;
    onClick?: () => void;
}) {
    const statusIcon: Record<PhaseStatus, React.ReactNode> = {
        pending: <Clock size={14} className="text-text-muted" />,
        running: <Loader2 size={14} className="text-status-info-text animate-spin" />,
        success: <CheckCircle2 size={14} className="text-status-success-text" />,
        error: <XCircle size={14} className="text-status-error-text" />,
    };

    const statusBg: Record<PhaseStatus, string> = {
        pending: "bg-zinc-800",
        running: "bg-status-info-bg",
        success: "bg-status-success-bg",
        error: "bg-status-error-bg",
    };

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                ${isSelected ? "bg-state-selected border border-border-strong" : "hover:bg-state-hover border border-transparent"}`}
        >
            {/* Status icon */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${statusBg[status]}`}>
                {statusIcon[status]}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-text-primary truncate">{name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    {duration && <span className="text-[10px] font-mono text-text-muted">{duration}</span>}
                    {tokens != null && (
                        <span className="text-[10px] font-mono text-status-success-text">{tokens < 1000 ? tokens : `${(tokens / 1000).toFixed(1)}k`} tok</span>
                    )}
                </div>
            </div>

            {/* Status badge */}
            <Badge variant={status === "success" ? "success" : status === "error" ? "error" : status === "running" ? "running" : "default"} size="xs">
                {status}
            </Badge>
        </button>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DesignSystemPortalPage() {
    const [selectedModel, setSelectedModel] = useState("gpt-4o");
    const [workspaceDraft, setWorkspaceDraft] = useState("");
    const [deepAgentDraft, setDeepAgentDraft] = useState("");
    const [selectedPhase, setSelectedPhase] = useState("phase-2");
    const [diffStates, setDiffStates] = useState<Record<string, DiffState>>({
        "diff-1": "pending",
        "diff-2": "approved",
        "diff-3": "pending",
    });
    const [settingsState, setSettingsState] = useState({
        autoApprove: true,
        smartNotifications: false,
        compactUI: true,
    });

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
            id: "smart-notifications",
            label: "Smart notifications",
            description: "Only alert when the agent needs input.",
            control: (
                <Switch
                    size="sm"
                    checked={settingsState.smartNotifications}
                    onChange={(checked) => setSettingsState((prev) => ({ ...prev, smartNotifications: checked }))}
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

    return (
        <div className="space-y-16">

            {/* ═══════════════════════════════════════════════════════════════════
                 SECTION 1: EXPLORE CHAT COMPONENTS
                 ═══════════════════════════════════════════════════════════════════ */}

            <div>
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-text-primary">Explore Chat</h2>
                    <p className="text-sm text-text-muted mt-1">
                        Conversational interface for exploring and working with the codebase.
                        Simple chat bubbles, inline tool calls, and session management.
                    </p>
                </div>

                {/* ── Message Bubbles ── */}
                <DocSection
                    title="Message Bubbles"
                    description="Chat message pattern: user messages right-aligned, assistant left-aligned with markdown. Supports thoughts, tool inline, and streaming state."
                >
                    <DocCard title="Conversation Flow" actions={<InspectButton doc={componentDocs.messageBubble} />}>
                        <div className="space-y-4 p-4 bg-bg-app rounded-lg border border-border-subtle">
                            <MessageBubble
                                role="user"
                                content="Can you analyze the auth flow and identify any potential race conditions?"
                            />
                            <MessageBubble
                                role="assistant"
                                content="I'll analyze the authentication flow. Let me check the relevant files first."
                                thoughts={[
                                    "Looking for auth-related files in the codebase...",
                                    "Found AuthContext.tsx, useAuth.ts, and middleware.ts",
                                    "Analyzing the token refresh mechanism for race conditions",
                                ]}
                            />
                            <MessageBubble
                                role="tool"
                                toolName="read_file"
                                content="packages/ui/src/context/AuthContext.tsx (245 lines)"
                            />
                            <MessageBubble
                                role="assistant"
                                content="I found a potential race condition in the token refresh flow. When multiple requests trigger a refresh simultaneously, they can each initiate a separate refresh call, leading to invalidated tokens."
                                isStreaming
                            />
                        </div>
                    </DocCard>
                    <DocRules
                        rules={[
                            "User bubbles align right with brand accent background.",
                            "Assistant bubbles align left with surface background and subtle border.",
                            "Tool results use monospace font with tool-specific accent color.",
                            "Show ThoughtsPanel above assistant content when reasoning steps exist.",
                            "Streaming state shows a pulsing cursor at the end of content.",
                        ]}
                    />
                </DocSection>

                {/* ── Chat Input ── */}
                <DocSection
                    title="Chat Input"
                    description="Primary input surface for prompting the agent. Supports footer actions and model selection."
                >
                    <DocCard title="Chat Input" actions={<InspectButton doc={componentDocs.chatInput} />}>
                        <ChatInput
                            value={workspaceDraft}
                            onChange={setWorkspaceDraft}
                            placeholder="Ask anything…"
                            onSend={() => setWorkspaceDraft("")}
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
                    </DocCard>
                    <DocRules
                        rules={[
                            "Keep the placeholder action-oriented and short.",
                            "Footer actions should be secondary and visually compact.",
                            "Use model selectors sparingly to avoid clutter.",
                        ]}
                    />
                    <DocCode
                        code={`<ChatInput value={draft} onChange={setDraft} onSend={send}
  footerLeft={<Selector label="LLM" value={model} options={opts} onSelect={setModel} />}
/>`}
                    />
                </DocSection>

                {/* ── Thread Feed ── */}
                <DocSection
                    title="Thread Feed"
                    description="Scrollable list of workspace threads with status and meta indicators."
                >
                    <DocCard title="Feed (7 Threads)" actions={<InspectButton doc={componentDocs.threadFeed} />}>
                        <div className="rounded-lg border border-border-subtle bg-bg-surface h-[360px]">
                            <ThreadFeed
                                title="Feed"
                                items={sampleThreads}
                                activeId="thread-1"
                                onSelect={(id) => console.log("select", id)}
                                headerAction={<Button size="xs">New</Button>}
                                footer={<span>7 total</span>}
                            />
                        </div>
                    </DocCard>
                    <DocRules
                        rules={[
                            "Show statuses with color plus short labels.",
                            "Keep the list height fixed inside panels for predictable layouts.",
                        ]}
                    />
                </DocSection>

                {/* ── Thoughts Panel ── */}
                <DocSection
                    title="Thoughts Panel"
                    description="Collapsible panel showing agent reasoning steps. Used inside assistant messages to display chain-of-thought."
                >
                    <DocCard title="Reasoning Mode" actions={<InspectButton doc={componentDocs.thoughtsPanel} />}>
                        <ThoughtsPanel thoughts={sampleThoughts} isReasoning />
                    </DocCard>
                    <DocCard title="Process Mode (Steps)">
                        <ThoughtsPanel
                            thoughts={[
                                "Read file: packages/ui/src/tokens/colors.ts",
                                "Parsed 48 color tokens across 6 categories.",
                                "Generated CSS variables for all tokens.",
                                "Wrote output to packages/ui/dist/tokens.css",
                            ]}
                        />
                    </DocCard>
                    <DocCode
                        code={`<ThoughtsPanel thoughts={["Step 1...", "Step 2..."]} isReasoning />`}
                    />
                </DocSection>

                {/* ── Code Block ── */}
                <DocSection
                    title="Code Block"
                    description="Syntax-highlighted code with language badge, line numbers, and copy button. Three rendering modes: inline, single-line compact, and full multi-line."
                >
                    <DocCard title="Multi-line Code Block" actions={<InspectButton doc={componentDocs.codeBlock} />}>
                        <CodeBlock className="language-typescript">
                            {`export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}`}
                        </CodeBlock>
                    </DocCard>
                    <DocCard title="Single-line (Compact)">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] text-text-secondary">File path:</span>
                            <CodeBlock className="language-text">packages/ui/src/hooks/useTheme.tsx</CodeBlock>
                        </div>
                    </DocCard>
                    <DocCard title="Inline Code">
                        <p className="text-[12px] text-text-secondary">
                            Use the <CodeBlock inline>useTheme()</CodeBlock> hook to access the current theme, or call{" "}
                            <CodeBlock inline>setTheme(&quot;dark&quot;)</CodeBlock> to switch.
                        </p>
                    </DocCard>
                    <DocCode
                        code={`<CodeBlock className="language-typescript">{code}</CodeBlock>
<CodeBlock inline>useTheme()</CodeBlock>`}
                    />
                </DocSection>

                {/* ── Tool Output ── */}
                <DocSection
                    title="Tool Output"
                    description="Displays tool execution results in a scrollable pre block with copy-on-hover. Supports error state styling."
                >
                    <DocCard title="Success Output" actions={<InspectButton doc={componentDocs.toolOutput} />}>
                        <ToolOutput output={`✓ File written: packages/ui/dist/tokens.css (141 variables)
✓ Generated CSS custom properties for colors, spacing, radius, motion
✓ Build completed in 0.14s`} />
                    </DocCard>
                    <DocCard title="Error Output">
                        <ToolOutput
                            output={`Error: ENOENT: no such file or directory, open '/Users/dev/project/src/missing-file.ts'
    at Object.openSync (node:fs:601:3)
    at readFileSync (node:fs:469:35)`}
                            isError
                        />
                    </DocCard>
                    <DocCode
                        code={`<ToolOutput output="File written successfully" />
<ToolOutput output="Error: ENOENT..." isError />`}
                    />
                </DocSection>

                {/* ── Token Usage & Duration ── */}
                <DocSection
                    title="Metrics: Tokens & Duration"
                    description="Compact metrics displays for token consumption and elapsed time. Used in session headers, phase items, and run summaries."
                >
                    <DocCard title="Token Usage Display" actions={<InspectButton doc={componentDocs.tokenUsageDisplay} />}>
                        <div className="flex items-center gap-6">
                            <div className="space-y-1">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider">With label</span>
                                <TokenUsageDisplay tokenUsage={sampleTokenUsage} />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider">Compact (no label)</span>
                                <TokenUsageDisplay tokenUsage={sampleTokenUsage} showLabel={false} />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider">Small count</span>
                                <TokenUsageDisplay tokenUsage={{ totalInputTokens: 200, totalOutputTokens: 50, totalTokens: 250 }} />
                            </div>
                        </div>
                    </DocCard>
                    <DocCard title="Duration Display (Live)" actions={<InspectButton doc={componentDocs.durationDisplay} />}>
                        <div className="flex items-center gap-6">
                            <div className="space-y-1">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider">Running (live)</span>
                                <DurationDisplay startedAt={new Date(Date.now() - 45000).toISOString()} />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider">Completed (frozen)</span>
                                <DurationDisplay
                                    startedAt={new Date(Date.now() - 120000).toISOString()}
                                    endedAt={new Date(Date.now() - 5000).toISOString()}
                                />
                            </div>
                        </div>
                    </DocCard>
                    <DocCode
                        code={`<TokenUsageDisplay tokenUsage={{ totalInputTokens: 1200, totalOutputTokens: 800, totalTokens: 2000 }} />
<DurationDisplay startedAt={startedAt} endedAt={endedAt} />`}
                    />
                </DocSection>
            </div>


            {/* ═══════════════════════════════════════════════════════════════════
                 SECTION 2: DEEP AGENT CHAT COMPONENTS
                 ═══════════════════════════════════════════════════════════════════ */}

            <div>
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-text-primary">Deep Agent Chat</h2>
                    <p className="text-sm text-text-muted mt-1">
                        Advanced workflow interface with phase-based execution, event cards, timeline, and approval flows.
                        Designed for complex multi-step agent operations.
                    </p>
                </div>

                {/* ── Event Cards ── */}
                <DocSection
                    title="Event Cards"
                    description="Structured event display for deep agent workflows. Each event has a kind badge, expandable content, metadata, and full-screen action."
                >
                    <DocCard title="Event Types" actions={<InspectButton doc={componentDocs.eventCard} />}>
                        <div className="space-y-3">
                            <EventCard
                                kind="system"
                                content="Session initialized. Graph: audit, Provider: azure (gpt-4o). Workspace: /Users/dev/numezis-coder-mcp"
                                meta="0.0s"
                            />
                            <EventCard
                                kind="user"
                                content="Run a full security audit on the authentication module. Focus on token refresh, session management, and input validation."
                                meta="0.1s"
                            />
                            <EventCard
                                kind="assistant"
                                content="I'll conduct a thorough security audit of the authentication module. Let me start by mapping all auth-related files and their dependencies, then systematically check for common vulnerabilities including race conditions in token refresh, session fixation, CSRF, and input injection vectors."
                                meta="2.3s"
                            />
                            <EventCard
                                kind="tool"
                                toolName="read_file"
                                content={`Reading: packages/ui/src/context/AuthContext.tsx\n\n// AuthContext.tsx (245 lines)\nimport { createContext, useContext, useState, useEffect } from 'react';\nimport type { UserProfile } from '@numezis/shared/supabase/types';\n\ninterface AuthState {\n  user: UserProfile | null;\n  token: string | null;\n  refreshToken: string | null;\n  isAuthenticated: boolean;\n  isLoading: boolean;\n}\n\n// ... 230 more lines`}
                                meta="120ms"
                                isExpanded
                            />
                        </div>
                    </DocCard>
                    <DocRules
                        rules={[
                            "Each event kind has a distinct color: system (zinc), user (brand), assistant (thinking), tool (tool accent).",
                            "Long content collapses by default with a preview excerpt.",
                            "Tool events render content in monospace font.",
                            "Full-screen expand button available for detailed inspection.",
                            "Metadata (duration) shown in the header for quick scanning.",
                        ]}
                    />
                </DocSection>

                {/* ── Timeline / Phase Items ── */}
                <DocSection
                    title="Timeline Phases"
                    description="Phase timeline sidebar for deep agent workflows. Shows execution progress with status, duration, and token usage per phase."
                >
                    <DocCard title="Phase Timeline" actions={<InspectButton doc={componentDocs.timelinePhase} />}>
                        <div className="rounded-lg border border-border-subtle bg-bg-surface p-2 space-y-1 max-w-[340px]">
                            <div className="px-3 py-2 flex items-center justify-between border-b border-border-subtle mb-1">
                                <span className="text-[11px] font-semibold text-text-primary uppercase tracking-wider">Timeline</span>
                                <div className="flex items-center gap-3">
                                    <TokenUsageDisplay tokenUsage={sampleTokenUsage} showLabel={false} />
                                    <DurationDisplay
                                        startedAt={new Date(Date.now() - 180000).toISOString()}
                                    />
                                </div>
                            </div>
                            <PhaseItem
                                name="Investigation"
                                status="success"
                                duration="1m 12s"
                                tokens={8400}
                                isSelected={selectedPhase === "phase-1"}
                                onClick={() => setSelectedPhase("phase-1")}
                            />
                            <PhaseItem
                                name="Claim Verification"
                                status="running"
                                duration="0m 45s"
                                tokens={4200}
                                isSelected={selectedPhase === "phase-2"}
                                onClick={() => setSelectedPhase("phase-2")}
                            />
                            <PhaseItem
                                name="Adjudication"
                                status="pending"
                                isSelected={selectedPhase === "phase-3"}
                                onClick={() => setSelectedPhase("phase-3")}
                            />
                            <PhaseItem
                                name="Remediation"
                                status="pending"
                                isSelected={selectedPhase === "phase-4"}
                                onClick={() => setSelectedPhase("phase-4")}
                            />
                            <PhaseItem
                                name="Report Generation"
                                status="pending"
                                isSelected={selectedPhase === "phase-5"}
                                onClick={() => setSelectedPhase("phase-5")}
                            />
                        </div>
                    </DocCard>
                    <DocRules
                        rules={[
                            "Use status-colored icons: check (success), spinner (running), clock (pending), X (error).",
                            "Show metrics inline: duration on left, token count on right.",
                            "Selected phase uses state-selected background with strong border.",
                            "Timeline header shows aggregated metrics for the full run.",
                        ]}
                    />
                </DocSection>

                {/* ── Deep Agent Chat Input ── */}
                <DocSection
                    title="Deep Agent Input"
                    description="Chat input with graph selector and stop/send controls. Uses more prominent graph selection than explore chat."
                >
                    <DocCard title="Input with Graph & LLM Controls">
                        <ChatInput
                            value={deepAgentDraft}
                            onChange={setDeepAgentDraft}
                            placeholder="Describe your task…"
                            onSend={() => setDeepAgentDraft("")}
                            footerLeft={(
                                <div className="flex items-center gap-2">
                                    <Selector
                                        label="Graph"
                                        value="audit"
                                        options={[
                                            { id: "audit", label: "Audit", sub: "Full code audit pipeline" },
                                            { id: "simple_react", label: "ReAct", sub: "Simple tool-calling agent" },
                                        ]}
                                        onSelect={() => {}}
                                        size="sm"
                                        direction="up"
                                    />
                                    <Selector
                                        label="LLM"
                                        value={selectedModel}
                                        options={sampleSelectorOptions}
                                        onSelect={setSelectedModel}
                                        size="sm"
                                        direction="up"
                                    />
                                </div>
                            )}
                            footerRight={(
                                <div className="flex items-center gap-1.5">
                                    <Button size="xs" variant="ghost" className="text-text-muted">
                                        <Play size={12} />
                                    </Button>
                                    <Button size="xs" variant="ghost" className="text-text-muted">
                                        <Pause size={12} />
                                    </Button>
                                </div>
                            )}
                        />
                    </DocCard>
                    <DocCode
                        code={`<ChatInput
  value={draft}
  onChange={setDraft}
  onSend={send}
  footerLeft={<><Selector label="Graph" ... /><Selector label="LLM" ... /></>}
  footerRight={<><Button>Play</Button><Button>Pause</Button></>}
/>`}
                    />
                </DocSection>

                {/* ── Diff Approval ── */}
                <DocSection
                    title="Diff Approval"
                    description="File diff review surface with approve/reject per-file and bulk actions. Shows additions, deletions, and inline diff previews."
                >
                    <DocCard title="Pending Approvals (3 files)" actions={<InspectButton doc={componentDocs.diffApproval} />}>
                        <DiffApproval
                            files={sampleDiffFiles}
                            states={diffStates}
                            onApprove={(id) => setDiffStates((prev) => ({ ...prev, [id]: "approved" }))}
                            onReject={(id) => setDiffStates((prev) => ({ ...prev, [id]: "rejected" }))}
                            onApproveAll={() => setDiffStates({ "diff-1": "approved", "diff-2": "approved", "diff-3": "approved" })}
                            onRejectAll={() => setDiffStates({ "diff-1": "rejected", "diff-2": "rejected", "diff-3": "rejected" })}
                            onReset={() => setDiffStates({ "diff-1": "pending", "diff-2": "pending", "diff-3": "pending" })}
                        />
                    </DocCard>
                    <DocRules
                        rules={[
                            "Pending files have neutral border, approved get success accent, rejected get error accent.",
                            "Show file type badge: NEW (green), DEL (red), or +N -N (neutral).",
                            "Inline diff preview shows first 5 lines with add/remove coloring.",
                            "Bulk actions (Approve All / Reject All / Reset) in a fixed header bar.",
                        ]}
                    />
                    <DocCode
                        code={`<DiffApproval
  files={files}
  states={states}
  onApprove={(id) => approve(id)}
  onReject={(id) => reject(id)}
  onApproveAll={approveAll}
  onRejectAll={rejectAll}
/>`}
                    />
                </DocSection>
            </div>


            {/* ═══════════════════════════════════════════════════════════════════
                 SECTION 3: SHARED INFRASTRUCTURE
                 ═══════════════════════════════════════════════════════════════════ */}

            <div>
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-text-primary">Shared Infrastructure</h2>
                    <p className="text-sm text-text-muted mt-1">
                        Components shared across explore chat and deep agent. Layout, tool panels, and settings.
                    </p>
                </div>

                {/* ── Tool Use Panel ── */}
                <DocSection
                    title="Tool Use Panel"
                    description="Activity log of tool calls with status, duration, and detail context."
                >
                    <DocCard title="Tool Use" actions={<InspectButton doc={componentDocs.toolUsePanel} />}>
                        <ToolUsePanel items={sampleToolUse} />
                    </DocCard>
                    <DocCode
                        code={`<ToolUsePanel items={[{ id: "1", name: "read_file", status: "success" }]} />`}
                    />
                </DocSection>

                {/* ── Workspace Layout ── */}
                <DocSection
                    title="Workspace Layout"
                    description="Flexible layout shell with header, sidebar, content, and aside slots. Used by both explore (ThreadFeed aside) and deep agent (Timeline aside)."
                >
                    <DocCard title="Layout Skeleton" actions={<InspectButton doc={componentDocs.workspaceLayout} />}>
                        <div className="h-[300px] rounded-lg border border-border-subtle overflow-hidden">
                            <WorkspaceLayout
                                sidebarWidth="w-40"
                                asideWidth="w-48"
                                header={
                                    <div className="px-3 py-2 flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-text-primary">Header</span>
                                        <div className="flex items-center gap-2">
                                            <TokenUsageDisplay tokenUsage={{ totalInputTokens: 500, totalOutputTokens: 200, totalTokens: 700 }} showLabel={false} />
                                            <DurationDisplay startedAt={new Date(Date.now() - 30000).toISOString()} />
                                        </div>
                                    </div>
                                }
                                sidebar={
                                    <div className="p-3 space-y-2">
                                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Sidebar</span>
                                        {["Session 1", "Session 2", "Session 3"].map((s) => (
                                            <div key={s} className="px-2 py-1.5 rounded text-[11px] text-text-secondary hover:bg-state-hover cursor-pointer">{s}</div>
                                        ))}
                                    </div>
                                }
                                content={
                                    <div className="p-4 flex items-center justify-center h-full">
                                        <span className="text-sm text-text-muted">Main Content Area</span>
                                    </div>
                                }
                                aside={
                                    <div className="p-3 space-y-2">
                                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Aside Panel</span>
                                        <div className="text-[11px] text-text-secondary">Timeline / Approvals</div>
                                    </div>
                                }
                            />
                        </div>
                    </DocCard>
                    <DocCode
                        code={`<WorkspaceLayout
  header={<Header />}
  sidebar={<ThreadFeed ... />}
  content={<ActiveSession ... />}
  aside={<TimelinePanel ... />}
/>`}
                    />
                </DocSection>

                {/* ── Settings Panel ── */}
                <DocSection
                    title="Settings Panel"
                    description="Standard layout for settings with labels, descriptions, and controls."
                >
                    <DocCard title="Settings Panel" actions={<InspectButton doc={componentDocs.settingsPanel} />}>
                        <SettingsPanel
                            title="Workspace Preferences"
                            description="Tune the agent experience without leaving the app."
                            items={settingsItems}
                        />
                    </DocCard>
                    <DocCode
                        code={`<SettingsPanel title="Workspace Preferences" items={settingsItems} />`}
                    />
                </DocSection>

                {/* ── Full Explore Layout Mockup ── */}
                <DocSection
                    title="Explore Chat Layout (Assembled)"
                    description="Full assembled explore chat layout showing ThreadFeed sidebar + message stream + chat input."
                >
                    <DocCard title="Explore Chat — Full Layout">
                        <div className="h-[480px] rounded-lg border border-border-subtle overflow-hidden">
                            <WorkspaceLayout
                                sidebarWidth="w-56"
                                header={
                                    <div className="px-4 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-semibold text-text-primary">Explore workspace</span>
                                            <Badge variant="running" size="xs">streaming</Badge>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <TokenUsageDisplay tokenUsage={{ totalInputTokens: 3200, totalOutputTokens: 1100, totalTokens: 4300 }} />
                                            <DurationDisplay startedAt={new Date(Date.now() - 95000).toISOString()} />
                                        </div>
                                    </div>
                                }
                                sidebar={
                                    <ThreadFeed
                                        title="Sessions"
                                        items={sampleThreads.slice(0, 5)}
                                        activeId="thread-1"
                                        onSelect={() => {}}
                                        headerAction={<Button size="xs">New</Button>}
                                    />
                                }
                                content={
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                            <MessageBubble role="user" content="Analyze the design system tokens." />
                                            <MessageBubble
                                                role="assistant"
                                                content="I found 141 CSS variables across 6 categories: surfaces, borders, text, states, chain status, and motion."
                                                thoughts={["Scanning token files...", "Found colors.ts, motion.ts, spacing.ts"]}
                                            />
                                            <MessageBubble role="tool" toolName="read_file" content="packages/ui/src/tokens/colors.ts (280 lines)" />
                                            <MessageBubble
                                                role="assistant"
                                                content="The token system is well-structured. Here are the key findings..."
                                                isStreaming
                                            />
                                        </div>
                                        <div className="border-t border-border-subtle p-3">
                                            <ChatInput
                                                value=""
                                                onChange={() => {}}
                                                placeholder="Follow up…"
                                                onSend={() => {}}
                                            />
                                        </div>
                                    </div>
                                }
                            />
                        </div>
                    </DocCard>
                </DocSection>

                {/* ── Full Deep Agent Layout Mockup ── */}
                <DocSection
                    title="Deep Agent Layout (Assembled)"
                    description="Full assembled deep agent layout showing timeline sidebar + event stream + input with graph controls."
                >
                    <DocCard title="Deep Agent — Full Layout">
                        <div className="h-[520px] rounded-lg border border-border-subtle overflow-hidden">
                            <WorkspaceLayout
                                asideWidth="w-72"
                                header={
                                    <div className="px-4 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Selector
                                                label="Graph"
                                                value="audit"
                                                options={[
                                                    { id: "audit", label: "Audit", sub: "Full pipeline" },
                                                    { id: "simple_react", label: "ReAct", sub: "Tool agent" },
                                                ]}
                                                onSelect={() => {}}
                                                size="sm"
                                            />
                                            <Badge variant="running" size="xs">Phase 2/5</Badge>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <TokenUsageDisplay tokenUsage={sampleTokenUsage} />
                                            <DurationDisplay startedAt={new Date(Date.now() - 180000).toISOString()} />
                                            <Button size="xs" variant="danger">Stop</Button>
                                        </div>
                                    </div>
                                }
                                content={
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                            <EventCard kind="system" content="Session started. Graph: audit, LLM: azure/gpt-4o" meta="0.0s" />
                                            <EventCard kind="user" content="Run security audit on the auth module." meta="0.1s" />
                                            <EventCard kind="assistant" content="Starting investigation phase. I'll map all auth files and check for vulnerabilities." meta="1.2s" />
                                            <EventCard
                                                kind="tool"
                                                toolName="list_files"
                                                content={`Found 12 auth-related files:\n  src/context/AuthContext.tsx\n  src/hooks/useAuth.ts\n  src/middleware.ts\n  app/api/auth/signin/route.ts\n  app/api/auth/me/route.ts\n  ... 7 more`}
                                                meta="85ms"
                                                isExpanded
                                            />
                                            <EventCard kind="assistant" content="Investigation complete. Found 23 potential claims across 12 files. Moving to verification phase." meta="1m 12s" />
                                        </div>
                                        <div className="border-t border-border-subtle p-3">
                                            <ChatInput
                                                value=""
                                                onChange={() => {}}
                                                placeholder="Add instructions…"
                                                onSend={() => {}}
                                                footerLeft={
                                                    <span className="text-[10px] text-text-muted">Phase 2 of 5 • Claim Verification</span>
                                                }
                                            />
                                        </div>
                                    </div>
                                }
                                aside={
                                    <div className="flex flex-col h-full">
                                        {/* Timeline */}
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                            <div className="px-3 py-2 flex items-center justify-between border-b border-border-subtle mb-1">
                                                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Timeline</span>
                                            </div>
                                            <PhaseItem name="Investigation" status="success" duration="1m 12s" tokens={8400} isSelected={false} />
                                            <PhaseItem name="Verification" status="running" duration="0m 45s" tokens={4200} isSelected />
                                            <PhaseItem name="Adjudication" status="pending" />
                                            <PhaseItem name="Remediation" status="pending" />
                                            <PhaseItem name="Report" status="pending" />
                                        </div>
                                        {/* Approvals summary */}
                                        <div className="border-t border-border-subtle p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Approvals</span>
                                                <Badge variant="warning" size="xs">2 pending</Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-elevated text-[11px]">
                                                    <FileCode size={12} className="text-text-muted" />
                                                    <span className="text-text-secondary truncate">AuthContext.tsx</span>
                                                    <Badge variant="warning" size="xs">pending</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-elevated text-[11px]">
                                                    <FileCode size={12} className="text-text-muted" />
                                                    <span className="text-text-secondary truncate">middleware.ts</span>
                                                    <Badge variant="success" size="xs">approved</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                }
                            />
                        </div>
                    </DocCard>
                </DocSection>
            </div>
        </div>
    );
}
