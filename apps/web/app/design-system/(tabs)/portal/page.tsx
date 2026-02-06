"use client";

import { useState } from "react";

import {
    Button,
    Selector,
    ChatInput,
    ThreadFeed,
    ToolUsePanel,
    SettingsPanel,
    Switch,
    type SelectorOption,
} from "@numezis/ui/components/design-system";

import { DocCard, DocCode, DocRules, DocSection } from "../../components/DocBlocks";
import { InspectButton } from "../../components/Inspector";
import { componentDocs } from "../../docs";

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

export default function DesignSystemPortalPage() {
    const [selectedModel, setSelectedModel] = useState("gpt-4o");
    const [workspaceDraft, setWorkspaceDraft] = useState("");
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
        <div className="space-y-12">
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
                    code={`<ChatInput value={draft} onChange={setDraft} onSend={send} />`}
                />
            </DocSection>

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

        </div>
    );
}
