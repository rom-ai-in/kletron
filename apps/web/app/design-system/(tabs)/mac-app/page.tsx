"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Terminal as TerminalIcon, Trash2 } from "lucide-react";

import {
    Button,
    ChatInput,
    ThreadFeed,
    SettingsPanel,
    Switch,
    WorkspaceLayout,
    ToolUsePanel,
} from "@numezis/ui/components/design-system";

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
        label: "User",
        meta: "now",
        content: "test",
    },
    {
        id: "evt-2",
        kind: "assistant",
        label: "Agent",
        meta: "now",
        content: "We need to understand the task, then update the UI and stream handling.",
    },
    {
        id: "evt-3",
        kind: "assistant",
        label: "Agent",
        meta: "180ms",
        toolName: "read_file",
        toolArgs: "{\n  \"path\": \"apps/desktop/src/app/App.tsx\"\n}",
    },
    {
        id: "evt-4",
        kind: "tool",
        label: "Tool",
        meta: "240ms",
        toolName: "read_file",
        toolOutput: "// App.tsx\n// ... first 30 lines",
    },
    {
        id: "evt-5",
        kind: "assistant",
        label: "Agent",
        meta: "just now",
        content: "I will align the design system view with the production chat timeline.",
    },
    {
        id: "evt-6",
        kind: "system",
        label: "System",
        meta: "just now",
        content: "Token usage: 1.6k input · 420 output",
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

export default function DesignSystemMacAppPage() {
    const [activeThreadId, setActiveThreadId] = useState("thread-1");
    const [draft, setDraft] = useState("");
    const [sendingDraft, setSendingDraft] = useState("Generating follow-up changes...");
    const [sendingActive, setSendingActive] = useState(true);
    const [settingsState, setSettingsState] = useState({
        autoApprove: true,
        streaming: true,
        compactUI: false,
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
        const isUser = event.kind === "user";
        const isSystem = event.kind === "system";

        if (isSystem) {
            return (
                <div key={`${event.id}-${index}`} className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] text-text-muted">
                    <div className="flex items-center justify-between">
                        <span>System</span>
                        <span>{event.meta}</span>
                    </div>
                    {event.content ? <div className="mt-1 text-text-secondary">{event.content}</div> : null}
                </div>
            );
        }

        return (
            <div key={`${event.id}-${index}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                    className={`w-full max-w-[75%] rounded-lg border px-3 py-2 text-sm ${
                        isUser
                            ? "border-border-subtle bg-transparent"
                            : "border-border-subtle bg-bg-surface"
                    }`}
                >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-text-muted">
                        <span className={isUser ? "text-amber-200" : "text-emerald-200"}>
                            {event.label}
                        </span>
                        <span>{event.meta}</span>
                    </div>
                    <div className="mt-1 text-text-secondary">{event.content}</div>
                </div>
            </div>
        );
    };

    const renderToolGroup = (events: SampleEvent[], index: number) => {
        const items = events.map((toolEvent, toolIdx) => {
            const isResult = toolEvent.kind === "tool";
            const detail = isResult ? toolEvent.toolOutput : toolEvent.toolArgs;
            const preview = formatToolPreview(detail);
            return {
                id: toolEvent.id ?? `${toolEvent.toolName ?? "tool"}-${toolIdx}`,
                name: toolEvent.toolName ?? "Tool",
                detail: preview || undefined,
                meta: toolEvent.meta,
                status: isResult ? "success" : "running",
            };
        });

        return (
            <ToolUsePanel
                key={`tools-${index}`}
                title="Tools"
                items={items}
                className="bg-bg-surface"
            />
        );
    };

    const renderDiffPreview = (rows: DiffPreviewRow[]) => (
        <div className="mt-3 border border-border-subtle">
            {rows.map((row, index) => {
                const leftCellClass =
                    row.type === "remove"
                        ? "bg-rose-500/15 text-rose-100 border-l-2 border-rose-400/50"
                        : row.type === "add"
                        ? "bg-bg-app/40 text-text-muted"
                        : "";
                const rightCellClass =
                    row.type === "add"
                        ? "bg-emerald-500/15 text-emerald-50 border-l-2 border-emerald-400/50"
                        : row.type === "remove"
                        ? "bg-bg-app/40 text-text-muted"
                        : "";
                const leftSign = row.type === "remove" ? "-" : row.type === "context" ? " " : "";
                const rightSign = row.type === "add" ? "+" : row.type === "context" ? " " : "";

                return (
                    <div
                        key={`diff-row-${index}`}
                        className={`grid grid-cols-[40px_minmax(0,1fr)_40px_minmax(0,1fr)] font-mono text-[10px] ${
                            row.type === "add" ? "bg-emerald-500/5" : row.type === "remove" ? "bg-rose-500/5" : ""
                        }`}
                    >
                        <div className={`text-right pr-2 select-none ${row.type === "remove" ? "text-rose-300" : "text-text-muted"}`}>
                            {row.left?.num ?? ""}
                        </div>
                        <div className={`px-2 py-1 ${leftCellClass}`}>
                            <div className="flex items-start gap-2">
                                <span className={`w-3 text-center text-[9px] ${row.type === "remove" ? "text-rose-300" : "text-text-muted"}`}>
                                    {leftSign}
                                </span>
                                <span className="whitespace-pre-wrap">{row.left?.text ?? ""}</span>
                            </div>
                        </div>
                        <div className={`text-right pr-2 select-none ${row.type === "add" ? "text-emerald-300" : "text-text-muted"}`}>
                            {row.right?.num ?? ""}
                        </div>
                        <div className={`px-2 py-1 ${rightCellClass}`}>
                            <div className="flex items-start gap-2">
                                <span className={`w-3 text-center text-[9px] ${row.type === "add" ? "text-emerald-300" : "text-text-muted"}`}>
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
                title="Mac App Layout"
                description="Primary desktop shell for the Mac app. Built on WorkspaceLayout but presented as the Mac app layout."
            >
                <DocCard title="Layout Example" actions={<InspectButton doc={componentDocs.workspaceLayout} />}>
                    <div className="rounded-xl border border-border-subtle bg-bg-app h-[600px] overflow-hidden">
                        <WorkspaceLayout
                            header={(
                                <div className="flex items-center justify-between px-4 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                                        Workspace Header
                                    </div>
                                    <Button size="xs">New thread</Button>
                                </div>
                            )}
                            sidebar={(
                                <ThreadFeed
                                    title="Threads"
                                    items={threadItems}
                                    activeId={activeThreadId}
                                    onSelect={(id) => setActiveThreadId(id)}
                                />
                            )}
                            content={(
                                <div className="flex h-full min-h-0 flex-col">
                                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                        <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs">
                                            <div className="text-sm font-semibold text-text-primary">Agent Session</div>
                                            <div className="text-[10px] text-text-muted">Updated now</div>
                                        </div>
                                    <div className="space-y-3">
                                        {renderItems.map((item, index) =>
                                            item.type === "tools"
                                                ? renderToolGroup(item.events, index)
                                                : renderEvent(item.event, index)
                                        )}
                                    </div>
                                    </div>
                                    <div className="border-t border-border-subtle p-3">
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
                                </div>
                            )}
                            aside={(
                                <div className="flex h-full flex-col">
                                    <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                                        <span>Uncommitted changes</span>
                                        <span>{sampleDiffs.length}</span>
                                    </div>
                                    <div className="space-y-1 border-b border-border-subtle px-2 py-2">
                                        {sampleDiffs.map((diff) => (
                                            <button
                                                key={diff.id}
                                                type="button"
                                                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate">{diff.path}</span>
                                                    <span className="text-[10px] text-text-muted">{diff.hunks}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-2 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-xs font-semibold text-text-primary">
                                                    {sampleDiffs[0].path}
                                                </div>
                                                <div className="text-[10px] text-text-muted">
                                                    {sampleDiffs[0].hunks} changes
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button size="xs" variant="secondary">
                                                    Accept all
                                                </Button>
                                                <Button size="xs" variant="ghost">
                                                    Reject all
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {sampleHunks.map((hunk) => (
                                                <div
                                                    key={hunk.id}
                                                    className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] text-text-muted"
                                                >
                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                        <span className="truncate">{hunk.label}</span>
                                                        <span className="text-[9px] text-text-muted">{hunk.meta}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button size="xs" variant="secondary">
                                                            Accept
                                                        </Button>
                                                        <Button size="xs" variant="ghost">
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {renderDiffPreview(sampleDiffPreviewRows)}
                                    </div>
                                </div>
                            )}
                            contentClassName="bg-bg-app"
                            sidebarClassName="bg-bg-surface"
                            asideClassName="bg-bg-app"
                            sidebarWidth="w-[300px]"
                            asideWidth="w-[320px]"
                        />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Keep tool activity compact and collapsible to avoid visual overload.",
                        "Inline tool activity near the relevant messages.",
                        "Keep the terminal toggle adjacent to the composer for fast access.",
                    ]}
                />
                <DocCode
                    code={`<WorkspaceLayout header={...} sidebar={...} content={...} aside={...} />`}
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
                description="Right-side panel for reviewing and accepting or rejecting edits."
            >
                <DocCard title="Pending Changes" actions={<InspectButton doc={componentDocs.workspaceLayout} />}>
                    <div className="rounded-lg border border-border-subtle bg-bg-app h-[260px] overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                            <span>Uncommitted changes</span>
                            <span>{sampleDiffs.length}</span>
                        </div>
                        <div className="space-y-1 border-b border-border-subtle px-2 py-2">
                            {sampleDiffs.map((diff) => (
                                <button
                                    key={`preview-${diff.id}`}
                                    type="button"
                                    className="w-full rounded-md px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate">{diff.path}</span>
                                        <span className="text-[10px] text-text-muted">{diff.hunks}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="flex h-[120px] flex-col gap-2 overflow-y-auto px-2 py-2 text-xs text-text-muted">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-text-primary">{sampleDiffs[0].path}</span>
                                <div className="flex items-center gap-1">
                                    <Button size="xs" variant="secondary">Accept all</Button>
                                    <Button size="xs" variant="ghost">Reject all</Button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-surface px-2 py-1">
                                <span>Change 1</span>
                                <div className="flex items-center gap-1">
                                    <Button size="xs" variant="secondary">Accept</Button>
                                    <Button size="xs" variant="ghost">Reject</Button>
                                </div>
                            </div>
                            {renderDiffPreview(sampleDiffPreviewRows)}
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Keep file paths truncated but accessible.",
                        "Show diff counts so users can triage quickly.",
                        "Expose Accept all / Reject all at the file level.",
                        "Allow accept/reject per change for granular control.",
                    ]}
                />
                <DocCode
                    code={`<aside>Uncommitted changes list + diff preview</aside>`}
                />
            </DocSection>
        </div>
    );
}
