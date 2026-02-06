"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import {
    ThinkingBubble,
    ThinkingList,
    ToolLog,
    DiffApproval,
    ContextChips,
    createFileChip,
    createFolderChip,
    createAgentChip,
    createModelChip,
    createTagChip,
    InlineCompletion,
    MultiLineCompletion,
    useInlineCompletion,
    type DiffFile,
    type DiffState,
    type ToolCall,
    type ThoughtItem,
} from "@numezis/ui/components/design-system";

import { DocCard, DocCode, DocRules, DocSection } from "../../components/DocBlocks";
import { InspectButton } from "../../components/Inspector";
import { componentDocs } from "../../docs";

const sampleTools: ToolCall[] = [
    { id: "1", name: "read_file", args: "auth.ts", status: "success" },
    { id: "2", name: "edit_file", args: "middleware.ts", status: "running" },
    { id: "3", name: "run_command", args: "npm test", status: "error" },
];

const sampleDiffFiles: DiffFile[] = [
    { id: "diff-1", filename: "auth.ts", additions: 12, deletions: 3, hunks: [{ oldStart: 1, newStart: 1, lines: [{ type: "context", content: "// existing code..." }, { type: "remove", content: "const old = 'value';" }, { type: "add", content: "const new = 'updated';" }] }] },
    { id: "diff-2", filename: "jwt.ts", additions: 45, deletions: 0, isNew: true },
    { id: "diff-3", filename: ".env", additions: 1, deletions: 0 },
];

const thoughts: ThoughtItem[] = [
    { id: "t1", summary: "Analyzing codebase structure...", content: "Found existing JWT middleware and token helpers in /src/lib." },
    { id: "t2", summary: "Planning changes", content: "Add refresh token flow, update middleware, and extend tests." },
    { id: "t3", summary: "Ready to apply updates", content: "Prepared diffs for review and staged pending edits." },
];

export default function DesignSystemAgentPage() {
    const [diffStates, setDiffStates] = useState<Record<string, DiffState>>({
        "diff-1": "pending",
        "diff-2": "pending",
        "diff-3": "pending",
    });

    const inlineCompletion = useInlineCompletion({
        suggestions: [
            "userId, { include: ['profile', 'settings'] })",
            "userId, { include: ['profile'] })",
        ],
    });

    const handleApprove = (id: string) => setDiffStates((prev) => ({ ...prev, [id]: "approved" }));
    const handleReject = (id: string) => setDiffStates((prev) => ({ ...prev, [id]: "rejected" }));
    const handleApproveAll = () => setDiffStates({ "diff-1": "approved", "diff-2": "approved", "diff-3": "approved" });
    const handleRejectAll = () => setDiffStates({ "diff-1": "rejected", "diff-2": "rejected", "diff-3": "rejected" });
    const handleReset = () => setDiffStates({ "diff-1": "pending", "diff-2": "pending", "diff-3": "pending" });

    return (
        <div className="space-y-12">
            <DocSection
                title="Thinking Bubbles"
                description="Transient reasoning state with optional expansion for detailed context."
            >
                <DocCard title="Thinking Bubble" actions={<InspectButton doc={componentDocs.thinkingBubble} />}>
                    <ThinkingBubble isActive summary="Analyzing codebase structure..." />
                </DocCard>
                <DocCard title="Thinking List" actions={<InspectButton doc={componentDocs.thinkingList} />}>
                    <ThinkingList thoughts={thoughts} activeThoughtId="t1" />
                </DocCard>
                <DocRules
                    rules={[
                        "Use a short summary for the collapsed state.",
                        "Only include full content when it provides real reasoning value.",
                    ]}
                />
            </DocSection>

            <DocSection
                title="Tool Execution Logs"
                description="Streaming tool calls with status indicators and metadata."
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <DocCard title="Tool Log" actions={<InspectButton doc={componentDocs.toolLog} />}>
                        <ToolLog tools={sampleTools} />
                    </DocCard>
                    <DocCard title="Status Icons">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { status: "success", icon: CheckCircle2, color: "text-emerald-400" },
                                { status: "running", icon: Loader2, color: "text-sky-400", spin: true },
                                { status: "error", icon: XCircle, color: "text-rose-400" },
                            ].map((s) => (
                                <div key={s.status} className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-800 text-[10px]">
                                    <s.icon className={`w-3 h-3 ${s.color} ${s.spin ? "animate-spin" : ""}`} />
                                    <span className="text-zinc-300">{s.status}</span>
                                </div>
                            ))}
                        </div>
                    </DocCard>
                </div>
                <DocCode
                    code={`<ToolLog tools={[{ id: "1", name: "read_file", status: "success" }]} />`}
                />
            </DocSection>

            <DocSection
                title="Context Chips"
                description="Compact chips for files, agents, models, and tags."
            >
                <DocCard title="Chip Variants" actions={<InspectButton doc={componentDocs.contextChips} />}>
                    <ContextChips
                        chips={[
                            createFileChip("auth.ts"),
                            createFolderChip("src/components"),
                            createAgentChip("Code Review"),
                            createModelChip("gpt-4o"),
                            createTagChip("security"),
                        ]}
                        onDismiss={(id) => console.log("dismiss", id)}
                    />
                </DocCard>
                <DocRules
                    rules={[
                        "Use file and folder chips for context sources.",
                        "Model chips are for provenance, not selection.",
                    ]}
                />
            </DocSection>

            <DocSection
                title="Diff Approval"
                description="High-trust review surface for edits with approve and reject flows."
            >
                <DocCard title="Diff Approval" actions={<InspectButton doc={componentDocs.diffApproval} />}>
                    <DiffApproval
                        files={sampleDiffFiles}
                        states={diffStates}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onApproveAll={handleApproveAll}
                        onRejectAll={handleRejectAll}
                        onReset={handleReset}
                    />
                </DocCard>
                <DocRules
                    rules={[
                        "Show file summary first; keep diffs collapsible for long files.",
                        "Always provide approve and reject actions for each file.",
                    ]}
                />
            </DocSection>

            <DocSection
                title="Inline Completion"
                description="Ghost text suggestions for in-editor assistance."
            >
                <DocCard title="Inline Completion" actions={<InspectButton doc={componentDocs.inlineCompletion} />}>
                    <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface font-mono text-sm">
                        <div className="flex">
                            <span className="text-zinc-300">const user = await fetchUser(</span>
                            <InlineCompletion text={inlineCompletion.currentSuggestion ?? ""} visible={inlineCompletion.showSuggestion} />
                        </div>
                        <p className="mt-3 text-[10px] text-text-muted">Press Tab to accept • Escape to dismiss</p>
                    </div>
                </DocCard>
                <DocCard title="Multi-line Completion" actions={<InspectButton doc={componentDocs.multiLineCompletion} />}>
                    <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface font-mono text-sm">
                        <MultiLineCompletion
                            lines={[
                                "if (!user) {",
                                "  throw new Error('User not found');",
                                "}",
                            ]}
                        />
                    </div>
                </DocCard>
                <DocCard title="useInlineCompletion" actions={<InspectButton doc={componentDocs.useInlineCompletion} />}>
                    <p className="text-xs text-text-secondary">
                        Hook for cycling suggestions, accepting, and dismissing ghost text.
                    </p>
                </DocCard>
                <DocCode
                    code={`const { currentSuggestion } = useInlineCompletion({ suggestions: ["..."] });
<InlineCompletion text={currentSuggestion ?? ""} />`}
                />
            </DocSection>
        </div>
    );
}
