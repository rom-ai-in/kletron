import React, { useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Brain, ChevronRight } from 'lucide-react';
import { ThoughtsPanel } from './ThoughtsPanel';
import { ChatInput, Modal, Selector } from '@numezis/ui/components/design-system';
import { ContextVisualizer } from '../context/ContextVisualizer';
import { DurationDisplay, TokenUsageDisplay } from "@numezis/ui/components/Agent/metrics";
import { MarkdownRenderer } from './MarkdownRenderer';
import { CopyButton } from './ChatMessage';
import { ToolInvocation as SharedToolInvocation } from './ToolInvocation';
import { useAgentSession } from '../../hooks/useAgentSession';
import { useAgentStream } from '../../hooks/useAgentStream';
import { useAgentEdits } from '../../hooks/useAgentEdits';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ActiveSessionProps {
    conversationId: string;
    title: string;
    onApproveEdit: (editId: string) => void;
    onApproveAll?: () => void;
    onRejectEdit?: (editId: string) => void;
    onRejectAll?: () => void;
    onTitleChange?: (newTitle: string) => void;
    showGraphSelector?: boolean;
    showContextButtons?: boolean;
    workspaceId?: string;
}

// ─── Component (pure rendering) ─────────────────────────────────────────────

export const ActiveSession: React.FC<ActiveSessionProps> = ({
    conversationId,
    title,
    onApproveEdit,
    onApproveAll,
    onRejectEdit,
    onRejectAll,
    onTitleChange,
    showGraphSelector = true,
    showContextButtons = true,
    workspaceId,
}) => {
    const [isGraphOpen, setIsGraphOpen] = React.useState(false);

    // Stable ref to break the circular dependency between useAgentStream ↔ useAgentEdits
    const loadDataRef = useRef<(opts?: { force?: boolean }) => Promise<void>>(async () => {});

    const stableLoadData = useCallback(
        async (opts?: { force?: boolean }) => { await loadDataRef.current(opts); },
        []
    );

    // ── Hooks ────────────────────────────────────────────────────────────
    const session = useAgentSession();

    const stream = useAgentStream({
        conversationId,
        loadData: stableLoadData,
        selectedGraphId: session.selectedGraphId,
        llmProvider: session.llmProvider,
        showGraphSelector,
        workspaceId,
        title,
        onTitleChange,
    });

    const edits = useAgentEdits({
        conversationId,
        workspaceId,
        setMessages: stream.setMessages,
        isAtBottomRef: stream.isAtBottomRef,
    });

    // Wire the ref so useAgentStream's loadData calls edits.loadData
    loadDataRef.current = edits.loadData;

    // Destructure for convenient access in JSX
    const {
        messages, input, setInput, sending,
        runStartedAt, runEndedAt, tokenUsage, streamStatus,
        handleSend, handleStop, handleKeyDown, formatTime,
    } = stream;

    const {
        pendingEdits, expandedEditId, setExpandedEditId,
        approvingAll, setApprovingAll, rejectingAll, setRejectingAll,
        bottomRef, scrollContainerRef, handleScroll,
    } = edits;

    // ── Focus management ─────────────────────────────────────────────────
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, [conversationId]);

    // Auto-scroll messages
    useEffect(() => {
        if (stream.isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, bottomRef, stream.isAtBottomRef]);

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-bg-surface">
            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-2 scrollbar-elegant"
            >
                {(runStartedAt || tokenUsage) && (
                    <div className="sticky top-0 z-10 mb-2 flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface/90 px-3 py-2 backdrop-blur">
                        <TokenUsageDisplay tokenUsage={tokenUsage} />
                        {tokenUsage?.callCount ? (
                            <span className="text-[10px] font-mono text-text-muted">
                                {tokenUsage.callCount} calls
                            </span>
                        ) : null}
                        {tokenUsage?.model ? (
                            <span className="text-[10px] font-mono text-text-muted">
                                {tokenUsage.model}
                            </span>
                        ) : null}
                        <DurationDisplay startedAt={runStartedAt} endedAt={runEndedAt} />
                    </div>
                )}
                {messages.map((m, i) => {
                    const isUser = m.role === 'user';
                    const isSystem = m.role === 'system';
                    const isTool = m.role === 'tool';
                    const isAssistant = m.role === 'assistant';

                    if (isSystem) return null;

                    // TOOL MESSAGE (Output) - content is handled within the invoking assistant message
                    if (isTool) return null;

                    // ASSISTANT / USER MESSAGE
                    return (
                        <div key={m.id || i} className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'} ${m.toolName ? 'mb-0' : 'mb-1'}`}>

                            {/* Thoughts / Planning (Only for Assistant) */}
                            {isAssistant && (
                                <div className="w-full max-w-[95%] mb-1">
                                    {(m.thoughts && m.thoughts.length > 0) ? (
                                        <ThoughtsPanel thoughts={m.thoughts} />
                                    ) : m.thinking ? (
                                        <ThoughtsPanel thoughts={[m.thinking]} isReasoning={true} />
                                    ) : null}
                                </div>
                            )}

                            {/* Main Message Bubble */}
                            <div className={`relative rounded-lg ${m.toolName ? 'p-0' : 'px-3 py-2'} ${isUser
                                ? 'shadow-sm border border-border-strong bg-bg-elevated text-text-primary max-w-[90%]'
                                : 'bg-transparent pl-0 pt-0 w-full'
                                }`}>

                                {/* Tool Call Indicator (Merged with output) */}
                                {m.toolName && (
                                    <SharedToolInvocation
                                        name={m.toolName}
                                        args={m.toolArgs}
                                        output={(() => {
                                            if (m.toolCallId) {
                                                const outputMsg = messages.find(om => om.role === 'tool' && om.toolCallId === m.toolCallId);
                                                if (outputMsg) return outputMsg.content || outputMsg.toolOutput;
                                            }
                                            const nextMsg = messages[i + 1];
                                            if (nextMsg?.role === 'tool') {
                                                return nextMsg.content || nextMsg.toolOutput;
                                            }
                                            return undefined;
                                        })()}
                                    />
                                )}

                                <div className={`text-[12px] break-words ${isUser ? 'text-text-primary' : 'text-text-secondary'}`}>
                                    <MarkdownRenderer content={m.content} />
                                </div>

                                {/* Timestamp Footer - Only for Assistant Messages (Non-tool) */}
                                {isAssistant && !m.toolName && (
                                    <div className="mt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
                                        <span className="text-[9px] text-text-muted font-mono">{formatTime(m.timestamp)}</span>
                                        <CopyButton content={m.content} />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Cursor-Style Changes Review Panel */}
                {pendingEdits.length > 0 && (
                    <div className="mt-4 mx-2 bg-bg-elevated/80 border border-status-warning-border rounded-lg shadow-xl overflow-hidden">
                        {/* Header with Batch Actions */}
                        <div className="flex items-center justify-between px-3 py-2 bg-bg-surface border-b border-border-subtle">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-status-warning animate-pulse"></div>
                                <span className="text-[11px] font-semibold text-status-warning-text">
                                    {pendingEdits.length} Pending Change{pendingEdits.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        setApprovingAll(true);
                                        try {
                                            if (onApproveAll) {
                                                await onApproveAll();
                                            } else {
                                                for (const edit of pendingEdits) {
                                                    await onApproveEdit(edit.id);
                                                }
                                            }
                                            await edits.loadData();
                                        } finally {
                                            setApprovingAll(false);
                                        }
                                    }}
                                    disabled={approvingAll || rejectingAll}
                                    className="py-1 px-2.5 bg-status-success-bg hover:bg-status-success-bg text-status-success-text border border-status-success-border hover:border-status-success-border rounded text-[10px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                                >
                                    {approvingAll ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                    Accept All
                                </button>
                                <button
                                    onClick={async () => {
                                        setRejectingAll(true);
                                        try {
                                            if (onRejectAll) {
                                                await onRejectAll();
                                            }
                                            await edits.loadData();
                                        } finally {
                                            setRejectingAll(false);
                                        }
                                    }}
                                    disabled={approvingAll || rejectingAll}
                                    className="py-1 px-2.5 bg-bg-surface hover:bg-status-error-bg text-text-muted hover:text-status-error-text border border-border-subtle hover:border-status-error-border rounded text-[10px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                                >
                                    {rejectingAll ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                                    Reject All
                                </button>
                            </div>
                        </div>

                        {/* File List */}
                        <div className="divide-y divide-border-subtle">
                            {pendingEdits.map(edit => {
                                const isExpanded = expandedEditId === edit.id;
                                const filePath = edit.args?.filePath || edit.args?.path || 'Unknown file';
                                const fileName = filePath.split('/').pop() || filePath;
                                const isCreate = edit.toolName === 'write_file';
                                const content = edit.args?.content || '';

                                return (
                                    <div key={edit.id} className="group">
                                        <button
                                            onClick={() => setExpandedEditId(isExpanded ? null : edit.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-state-hover transition-colors text-left"
                                        >
                                            <ChevronRight
                                                size={12}
                                                className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                            />
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isCreate ? 'bg-status-success-bg text-status-success-text border border-status-success-border' : 'bg-status-warning-bg text-status-warning-text border border-status-warning-border'}`}>
                                                {isCreate ? 'NEW' : 'EDIT'}
                                            </span>
                                            <span className="text-[11px] font-mono text-text-secondary truncate flex-1">
                                                {fileName}
                                            </span>
                                            <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatTime(edit.createdAt)}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div className="px-3 pb-3 pt-1 bg-bg-surface">
                                                <div className="text-[9px] font-mono text-text-muted mb-2 truncate">
                                                    {filePath}
                                                </div>

                                                {content && (
                                                    <div className="bg-bg-elevated border border-border-subtle rounded p-2 mb-2 overflow-hidden">
                                                        <pre className="text-[10px] font-mono text-text-muted whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-elegant">
                                                            {content.length > 500 ? content.substring(0, 500) + '\n... (truncated)' : content}
                                                        </pre>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onApproveEdit(edit.id)}
                                                        className="flex-1 py-1.5 px-3 bg-status-success-bg hover:bg-status-success-bg text-status-success-text border border-status-success-border hover:border-status-success-border rounded flex items-center justify-center gap-1.5 transition-all text-[10px] font-medium"
                                                    >
                                                        <CheckCircle size={11} /> Accept
                                                    </button>
                                                    <button
                                                        onClick={() => onRejectEdit?.(edit.id)}
                                                        className="flex-1 py-1.5 px-3 bg-bg-surface hover:bg-status-error-bg text-text-muted hover:text-status-error-text border border-border-subtle hover:border-status-error-border rounded flex items-center justify-center gap-1.5 transition-all text-[10px] font-medium"
                                                    >
                                                        <XCircle size={11} /> Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {sending && (
                    <div className="flex items-center gap-2 ml-1 opacity-70">
                        <Loader2 className="w-3 h-3 animate-spin text-text-muted" />
                        <span className="text-[10px] italic text-text-muted">Agent is thinking...</span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="sticky bottom-0 border-t border-border-subtle bg-bg-surface px-4 py-4 backdrop-blur-md">
                <div className="mx-auto max-w-4xl">
                    <ChatInput
                        ref={textareaRef}
                        value={input}
                        onChange={setInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything (⌘L), @ to mention, / for workflows"
                        sending={sending}
                        onSend={() => void handleSend()}
                        onStop={handleStop}
                        footerLeft={(
                            <div className="flex items-center gap-2">
                                {showContextButtons && (
                                    <button
                                        type="button"
                                        onClick={() => setIsGraphOpen(true)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                        title="View Context Graph"
                                    >
                                        <Brain className="h-4 w-4" />
                                    </button>
                                )}
                                {showGraphSelector && (
                                    <Selector
                                        label="GRAPH"
                                        value={session.selectedGraphId}
                                        options={session.graphSelectOptions}
                                        onSelect={session.handleGraphChange}
                                        direction="up"
                                        size="sm"
                                        loading={!session.graphOptionsLoaded}
                                    />
                                )}
                                <Selector
                                    label="LLM"
                                    value={session.llmProvider}
                                    options={session.llmOptions}
                                    onSelect={session.handleLlmChange}
                                    direction="up"
                                    size="sm"
                                    status={session.llmStatus}
                                    loading={!session.llmPrefsLoaded || !session.enabledProvidersLoaded}
                                />
                            </div>
                        )}
                    />
                    <div className="mt-1 flex items-center justify-end text-[10px] text-text-muted">
                        <span
                            className={
                                streamStatus === "streaming"
                                    ? "text-status-success-text"
                                    : streamStatus === "stopped"
                                        ? "text-status-warning-text"
                                        : streamStatus === "error"
                                            ? "text-status-error-text"
                                            : "text-text-muted"
                            }
                        >
                            {streamStatus === "streaming"
                                ? "Streaming"
                                : streamStatus === "stopped"
                                    ? "Stopped"
                                    : streamStatus === "error"
                                        ? "Reconnecting"
                                        : "Idle"}
                        </span>
                    </div>
                </div>
            </div>

            {showContextButtons && (
                <>
                    <Modal
                        open={isGraphOpen}
                        onClose={() => setIsGraphOpen(false)}
                        title="Context Graph Visualizer"
                        subtitle="Live Agent Context Memory"
                        fullHeight
                    >
                        <ContextVisualizer />
                    </Modal>
                </>
            )}
        </div>
    );
};

/* CopyButton and ToolInvocation are now imported from shared design system components */
