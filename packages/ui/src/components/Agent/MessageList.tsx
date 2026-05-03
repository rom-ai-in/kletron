'use client';

import React, { useEffect, useRef, useMemo, useCallback, useLayoutEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { MessageBubble, SystemMessage } from './ChatMessage';
import { X, RotateCcw } from 'lucide-react';
import { Textarea } from '../design-system';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolInvocation } from './ToolInvocation';
import { ToolBatchAccordion } from './ToolBatchAccordion';
import type { ToolPair } from './ToolBatchAccordion';
import { ThoughtsPanel } from './ThoughtsPanel';
import { AgentActivityStrip } from './AgentActivityStrip';
import { AgentStatusShimmerLabel } from './AgentStatusShimmerLabel';
import type { ActivitySourceEvent } from '../../lib/agentActivity';
import type { ChatEvent, RenderItem } from '@kletron/shared/chatTypes';
import { sanitizeAssistantStreamPreview } from '@kletron/shared/contentSanitizer';
import { groupEvents, pairToolEvents } from '../../lib/toolPairing';

// Re-export for backward compatibility
export type { ChatEvent, RenderItem };
export { groupEvents };

/** Below this, use absolute positioning + height estimates; short threads render normally (no phantom gap). */
const VIRTUALIZE_MIN_ITEMS = 16;

/** Stable row key for virtualization height cache — survives index shifts when grouping changes. */
function renderItemStableKey(item: RenderItem, index: number): string {
    if (item.type === 'tools') {
        const ids = item.events.map((e) => e.id ?? '').join('|');
        return ids ? `tools:${ids}` : `tools:idx-${index}`;
    }
    const id = item.event.id ?? '';
    return id ? `evt:${id}` : `evt:idx-${index}`;
}

/**
 * Render a thin "── Stage X of Y — <name> ──" separator for events that come
 * from an automation thread. We render it above the synthetic user message
 * (the stage prompt). Assistant replies in the same stage carry the same
 * metadata but skip the separator since the user message already labelled it.
 */
function renderStageSeparator(event: ChatEvent, isUser: boolean): React.ReactNode {
    const meta = event.metadata as Record<string, any> | undefined;
    if (!meta) return null;
    if (meta.source !== 'automation') return null;
    const stageIndex = typeof meta.stageIndex === 'number' ? meta.stageIndex : null;
    const stageTotal = typeof meta.stageTotal === 'number' ? meta.stageTotal : null;
    if (stageIndex == null) return null;
    // Only render the banner once per stage — above the user prompt that
    // introduces the stage. Stage 0 has no banner because it is the very
    // start of the conversation.
    if (!isUser || stageIndex === 0) return null;
    const stageName = typeof meta.stageName === 'string' ? meta.stageName : '';
    const stageNum = stageIndex + 1;
    const totalLabel = stageTotal ? ` of ${stageTotal}` : '';
    return (
        <div className="my-3 flex items-center gap-2 px-1">
            <span className="h-px flex-1 bg-border-subtle" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
                Stage {stageNum}{totalLabel}
                {stageName ? ` — ${stageName}` : ''}
            </span>
            <span className="h-px flex-1 bg-border-subtle" />
        </div>
    );
}

/**
 * Render the "View detailed stage trace" link below assistant replies that
 * came from a hidden sub-stage run.
 */
function renderSubRunLink(event: ChatEvent): React.ReactNode {
    const meta = event.metadata as Record<string, any> | undefined;
    if (!meta || meta.source !== 'automation') return null;
    const subRunId = typeof meta.subRunId === 'string' ? meta.subRunId : null;
    if (!subRunId) return null;
    return (
        <div className="mt-1 ml-2">
            <a
                href={`/app/agent?sessionId=${subRunId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-accent-cyan hover:underline"
            >
                View detailed stage trace →
            </a>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MessageList — scrollable chat container with auto-scroll
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface MessageListProps {
    /** Raw events list — will be grouped automatically */
    events: ChatEvent[];
    /** Pre-grouped render items — use this if you've already called groupEvents */
    renderItems?: RenderItem[];
    /** Slot rendered per user/assistant message for edit controls etc. */
    messageActions?: (event: ChatEvent) => React.ReactNode;
    /** Whether the agent is currently streaming */
    streaming?: boolean;
    /** Progressive streaming text (token-by-token accumulation). */
    streamingText?: string;
    /** Live reasoning stream (`reasoning_delta` chunks). */
    streamingReasoning?: string;
    /** Recent raw events for the activity strip (e.g. full `eventStream` while streaming). */
    activityEvents?: ActivitySourceEvent[];
    /** ISO time when the current run started (elapsed label on activity strip). */
    runStartedAt?: string | null;
    /** Tool approvals waiting on the user — shown in-thread with wave emphasis (not in the strip). */
    pendingApprovalCount?: number;
    /** Show tool calls in compact (single-line) mode */
    compactTools?: boolean;
    /** Additional className for the scroll container */
    className?: string;
    /** Content to render after messages (e.g. pending edits panel) */
    footer?: React.ReactNode;
    /** Max number of events kept in DOM for performance */
    maxVisibleEvents?: number;
    /** Pagination controls for older messages */
    hasOlder?: boolean;
    loadingOlder?: boolean;
    onLoadOlder?: () => void;
    /** Enable dynamic-height virtualization */
    virtualized?: boolean;
    /** Auto-prefetch when scroll gets near top */
    prefetchNearTop?: boolean;
    /** Triggered when near top threshold is reached */
    onNearTop?: () => void;
    editingMessageIndex?: number | null;
    editingMessageDraft?: string;
    editingMessageSaving?: boolean;
    editingMessageError?: string | null;
    onEditDraftChange?: (draft: string) => void;
    onCancelEdit?: () => void;
    onResendEdit?: () => void;
}

const MessageListInner: React.FC<MessageListProps> = ({
    events,
    renderItems: externalRenderItems,
    messageActions,
    streaming,
    streamingText,
    streamingReasoning,
    activityEvents,
    runStartedAt,
    pendingApprovalCount = 0,
    compactTools = false,
    className,
    footer,
    maxVisibleEvents = 400,
    hasOlder = false,
    loadingOlder = false,
    onLoadOlder,
    virtualized = true,
    prefetchNearTop = false,
    onNearTop,
    editingMessageIndex,
    editingMessageDraft,
    editingMessageSaving = false,
    editingMessageError,
    onEditDraftChange,
    onCancelEdit,
    onResendEdit,
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const previousScrollHeightRef = useRef<number | null>(null);
    const previousScrollTopRef = useRef<number>(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [measureVersion, setMeasureVersion] = useState(0);
    const itemHeightsRef = useRef<Map<string, number>>(new Map());
    const observerMapRef = useRef<Map<string, ResizeObserver>>(new Map());
    const nodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const estimatedItemHeight = 92;
    const nearTopTriggeredRef = useRef(false);

    const { visibleEvents, hiddenCount } = useMemo(() => {
        if (externalRenderItems) {
            return { visibleEvents: events, hiddenCount: 0 };
        }
        if (events.length <= maxVisibleEvents) {
            return { visibleEvents: events, hiddenCount: 0 };
        }
        const start = Math.max(0, events.length - maxVisibleEvents);
        return { visibleEvents: events.slice(start), hiddenCount: start };
    }, [events, externalRenderItems, maxVisibleEvents]);

    const items = useMemo(
        () => externalRenderItems ?? groupEvents(visibleEvents),
        [visibleEvents, externalRenderItems],
    );

    const rowKeys = useMemo(
        () => items.map((item, index) => renderItemStableKey(item, index)),
        [items],
    );

    const rowKeyFingerprint = rowKeys.join('\n');

    useEffect(() => {
        const valid = new Set(rowKeys);
        for (const key of Array.from(observerMapRef.current.keys())) {
            if (!valid.has(key)) {
                observerMapRef.current.get(key)?.disconnect();
                observerMapRef.current.delete(key);
                nodeMapRef.current.delete(key);
                itemHeightsRef.current.delete(key);
            }
        }
    }, [rowKeyFingerprint, rowKeys]);

    const useVirtualList = virtualized && items.length >= VIRTUALIZE_MIN_ITEMS;

    const streamingMarkdownSafe = useMemo(
        () => sanitizeAssistantStreamPreview(streamingText ?? ''),
        [streamingText],
    );

    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setScrollTop(scrollTop);
        isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
        if (!prefetchNearTop || !onNearTop || loadingOlder || !hasOlder) return;
        const nearTopThreshold = 220;
        if (scrollTop <= nearTopThreshold) {
            if (!nearTopTriggeredRef.current) {
                nearTopTriggeredRef.current = true;
                onNearTop();
            }
        } else if (scrollTop > nearTopThreshold * 2) {
            nearTopTriggeredRef.current = false;
        }
    }, [prefetchNearTop, onNearTop, loadingOlder, hasOlder]);

    useLayoutEffect(() => {
        if (!scrollRef.current) return;
        setViewportHeight(scrollRef.current.clientHeight);
    }, []);

    useEffect(() => {
        if (!scrollRef.current) return;
        const observer = new ResizeObserver(() => {
            if (!scrollRef.current) return;
            setViewportHeight(scrollRef.current.clientHeight);
        });
        observer.observe(scrollRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!loadingOlder || !scrollRef.current) return;
        previousScrollHeightRef.current = scrollRef.current.scrollHeight;
        previousScrollTopRef.current = scrollRef.current.scrollTop;
    }, [loadingOlder]);

    useEffect(() => {
        if (loadingOlder || previousScrollHeightRef.current == null || !scrollRef.current) return;
        const newHeight = scrollRef.current.scrollHeight;
        const delta = newHeight - previousScrollHeightRef.current;
        scrollRef.current.scrollTop = previousScrollTopRef.current + Math.max(delta, 0);
        previousScrollHeightRef.current = null;
        nearTopTriggeredRef.current = false;
    }, [loadingOlder, items, measureVersion]);

    const offsets = useMemo(() => {
        const starts: number[] = new Array(items.length);
        const heights: number[] = new Array(items.length);
        let y = 0;
        for (let i = 0; i < items.length; i += 1) {
            starts[i] = y;
            const rowKey = rowKeys[i] ?? `evt:idx-${i}`;
            const h = itemHeightsRef.current.get(rowKey) ?? estimatedItemHeight;
            heights[i] = h;
            y += h;
        }
        return { starts, heights, totalHeight: y };
    }, [items, rowKeys, measureVersion]);

    const findStartIndex = useCallback((targetOffset: number) => {
        let lo = 0;
        let hi = offsets.starts.length - 1;
        let ans = 0;
        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (offsets.starts[mid] <= targetOffset) {
                ans = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return ans;
    }, [offsets.starts]);

    const virtualizationWindow = useMemo(() => {
        if (!useVirtualList || items.length === 0) {
            return { startIndex: 0, endIndex: items.length - 1 };
        }
        const overscan = 500;
        const startY = Math.max(0, scrollTop - overscan);
        const endY = scrollTop + Math.max(viewportHeight, 600) + overscan;
        const startIndex = findStartIndex(startY);
        let endIndex = startIndex;
        while (endIndex < items.length && (offsets.starts[endIndex] + offsets.heights[endIndex]) < endY) {
            endIndex += 1;
        }
        return {
            startIndex: Math.max(0, startIndex),
            endIndex: Math.min(items.length - 1, Math.max(startIndex, endIndex)),
        };
    }, [useVirtualList, items.length, scrollTop, viewportHeight, findStartIndex, offsets.starts, offsets.heights]);

    const measureItem = useCallback((rowKey: string, node: HTMLDivElement | null) => {
        const prevObserver = observerMapRef.current.get(rowKey);
        const prevNode = nodeMapRef.current.get(rowKey);
        if (prevNode && prevNode !== node && prevObserver) {
            prevObserver.disconnect();
            observerMapRef.current.delete(rowKey);
            nodeMapRef.current.delete(rowKey);
        }

        if (!node) return;

        const h = node.offsetHeight;
        const prev = itemHeightsRef.current.get(rowKey);
        if (prev !== h) {
            itemHeightsRef.current.set(rowKey, h);
            setMeasureVersion((v) => v + 1);
        }

        if (!observerMapRef.current.has(rowKey) || nodeMapRef.current.get(rowKey) !== node) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const newH = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height);
                    const cached = itemHeightsRef.current.get(rowKey);
                    if (cached !== newH && newH > 0) {
                        itemHeightsRef.current.set(rowKey, newH);
                        setMeasureVersion((v) => v + 1);
                    }
                }
            });
            observer.observe(node);
            observerMapRef.current.set(rowKey, observer);
            nodeMapRef.current.set(rowKey, node);
        }
    }, []);

    // Cleanup all observers on unmount
    useEffect(() => {
        const map = observerMapRef.current;
        return () => {
            map.forEach((observer) => observer.disconnect());
            map.clear();
        };
    }, []);

    useLayoutEffect(() => {
        if (!isAtBottomRef.current || !scrollRef.current) return;
        const el = scrollRef.current;
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    }, [items, streaming, streamingText, streamingReasoning, pendingApprovalCount, measureVersion]);

    const renderMessageItem = useCallback((item: RenderItem, index: number) => {
        if (item.type === 'tools') {
            const pairs = pairToolEvents(item.events);
            return (
                <ToolBatchAccordion key={`tools-${index}`} pairs={pairs} compact={compactTools} />
            );
        }

        const event = item.event;

        if (event.kind === 'system') {
            return <SystemMessage key={event.id || `sys-${index}`} content={event.content || ''} />;
        }

        if (event.kind === 'tool') return null;

        const isAssistant = event.kind === 'assistant';
        const isUser = event.kind === 'user';
        const isEditing = isUser && typeof event.messageIndex === 'number' && event.messageIndex === editingMessageIndex;

        // Automation stage separator — rendered above the synthetic user message
        // that introduces stage i (and again above the assistant reply, which is
        // suppressed because the user separator already labels the boundary).
        const stageSeparator = renderStageSeparator(event, isUser);

        return (
            <div
                key={event.id || `msg-${index}`}
                className={event.toolName ? 'mb-0' : isUser ? 'mb-0.5' : 'mb-1'}
            >
                {stageSeparator}
                {isAssistant && (
                    <>
                        {event.thoughts && event.thoughts.length > 0 ? (
                            <div className="w-full max-w-[95%] mb-1">
                                <ThoughtsPanel thoughts={event.thoughts} />
                            </div>
                        ) : event.thinking ? (
                            <div className="w-full max-w-[95%] mb-1">
                                <ThoughtsPanel thoughts={[event.thinking]} isReasoning />
                            </div>
                        ) : null}
                    </>
                )}

                {isEditing ? (
                    <div className="flex flex-col items-end">
                        {/* Same shell as MessageBubble user — no brand ring / heavy border */}
                        <div
                            className={cn(
                                'w-full max-w-[min(85%,28rem)] rounded-xl border border-white/[0.08]',
                                'bg-white/[0.04] px-3 py-2 text-[13px] leading-snug text-text-primary space-y-2',
                            )}
                        >
                            <Textarea
                                value={editingMessageDraft ?? ''}
                                onChange={(e) => onEditDraftChange?.(e.target.value)}
                                disabled={editingMessageSaving}
                                noResize
                                className="!bg-transparent !border-none !ring-0 !shadow-none !p-0 text-[13px] leading-snug w-full min-h-[2.5rem]"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        onResendEdit?.();
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        onCancelEdit?.();
                                    }
                                }}
                            />
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.06]">
                                <span className="text-[10px] text-text-muted shrink min-w-0">
                                    <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[9px] font-mono">⌘↵</kbd>
                                    {' '}resend ·{' '}
                                    <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[9px] font-mono">esc</kbd>
                                    {' '}cancel
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onCancelEdit?.(); }}
                                        disabled={editingMessageSaving}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onResendEdit?.(); }}
                                        disabled={editingMessageSaving}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Resend
                                    </button>
                                </div>
                            </div>
                            {editingMessageError && (
                                <div className="text-[10px] text-status-error-text">{editingMessageError}</div>
                            )}
                        </div>
                    </div>
                ) : event.content ? (
                    <>
                        <MessageBubble
                            role={event.kind === 'error' ? 'system' : event.kind}
                            content={event.content ?? ''}
                            timestamp={event.timestamp}
                            actions={messageActions?.(event)}
                        />
                        {isAssistant && renderSubRunLink(event)}
                    </>
                ) : null}
            </div>
        );
    }, [compactTools, messageActions, editingMessageIndex, editingMessageDraft, editingMessageSaving, editingMessageError, onEditDraftChange, onCancelEdit, onResendEdit]);

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn('flex-1 overflow-y-auto p-2 scrollbar-elegant', className)}
        >
            <div className="space-y-2">
                {hasOlder && (
                    <div className="sticky top-1 z-10 flex justify-center">
                        <button
                            type="button"
                            disabled={loadingOlder || !onLoadOlder}
                            onClick={onLoadOlder}
                            className="rounded border border-border-subtle bg-bg-elevated px-3 py-1 text-[11px] text-text-secondary hover:bg-state-hover disabled:opacity-60"
                        >
                            {loadingOlder ? 'Loading older…' : 'Load older messages'}
                        </button>
                    </div>
                )}
                {hiddenCount > 0 && (
                    <div className="rounded border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] text-text-muted">
                        {hiddenCount} older messages hidden for performance
                    </div>
                )}
                {useVirtualList && items.length > 0 ? (
                    <div style={{ position: 'relative', height: offsets.totalHeight }}>
                        {items.slice(virtualizationWindow.startIndex, virtualizationWindow.endIndex + 1).map((item, localIndex) => {
                            const index = virtualizationWindow.startIndex + localIndex;
                            const rowKey = rowKeys[index] ?? `evt:idx-${index}`;
                            const top = offsets.starts[index] ?? 0;
                            return (
                                <div
                                    key={rowKey}
                                    ref={(node) => measureItem(rowKey, node)}
                                    style={{ position: 'absolute', top, left: 0, right: 0 }}
                                >
                                    {renderMessageItem(item, index)}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    items.map((item, index) => {
                        const rowKey = rowKeys[index] ?? `evt:idx-${index}`;
                        return (
                            <div key={rowKey} ref={(node) => measureItem(rowKey, node)}>
                                {renderMessageItem(item, index)}
                            </div>
                        );
                    })
                )}
            </div>

            {streaming && (
                <div className="mt-1.5 w-full max-w-[95%] flex flex-col items-start gap-1.5">
                    <AgentActivityStrip
                        streaming={streaming}
                        streamingText={streamingText ?? ''}
                        streamingReasoning={streamingReasoning}
                        events={activityEvents ?? []}
                        runStartedAt={runStartedAt}
                    />
                    {streamingReasoning?.trim() ? (
                        <ThoughtsPanel thoughts={[streamingReasoning]} isReasoning defaultExpanded={false} />
                    ) : null}
                    {(streamingText ?? '').trim() ? (
                        <div className="w-full text-[13px] text-text-primary pl-0.5">
                            {streamingMarkdownSafe ? (
                                <MarkdownRenderer content={streamingMarkdownSafe} variant="chat" />
                            ) : (
                                <span className="text-text-muted/50 text-[11px]"> … </span>
                            )}
                            <span className="inline-block w-[2px] h-[14px] bg-text-primary/50 align-text-bottom ml-0.5 animate-pulse" />
                        </div>
                    ) : null}
                </div>
            )}

            {pendingApprovalCount > 0 && (
                <div className="mt-1.5 w-full max-w-[95%] flex flex-col items-start gap-0.5 pl-0.5">
                    <AgentStatusShimmerLabel
                        className="text-[12px]"
                        tone="secondary"
                        textClassName="font-medium"
                    >
                        {pendingApprovalCount === 1
                            ? 'Awaiting your approval…'
                            : `Awaiting your approval (${pendingApprovalCount} actions)…`}
                    </AgentStatusShimmerLabel>
                    <p className="text-[11px] text-text-muted">
                        Use Approve or Reject in the approvals area below.
                    </p>
                </div>
            )}

            {footer}

            <div ref={bottomRef} />
        </div>
    );
};

export const MessageList = React.memo(
    MessageListInner,
    (prev, next) =>
        prev.events === next.events &&
        prev.renderItems === next.renderItems &&
        prev.streaming === next.streaming &&
        prev.streamingText === next.streamingText &&
        prev.streamingReasoning === next.streamingReasoning &&
        prev.activityEvents === next.activityEvents &&
        prev.runStartedAt === next.runStartedAt &&
        prev.pendingApprovalCount === next.pendingApprovalCount &&
        prev.compactTools === next.compactTools &&
        prev.className === next.className &&
        prev.footer === next.footer &&
        prev.messageActions === next.messageActions &&
        prev.maxVisibleEvents === next.maxVisibleEvents &&
        prev.hasOlder === next.hasOlder &&
        prev.loadingOlder === next.loadingOlder &&
        prev.onLoadOlder === next.onLoadOlder &&
        prev.virtualized === next.virtualized &&
        prev.prefetchNearTop === next.prefetchNearTop &&
        prev.onNearTop === next.onNearTop &&
        prev.editingMessageIndex === next.editingMessageIndex &&
        prev.editingMessageDraft === next.editingMessageDraft &&
        prev.editingMessageSaving === next.editingMessageSaving &&
        prev.editingMessageError === next.editingMessageError &&
        prev.onEditDraftChange === next.onEditDraftChange &&
        prev.onCancelEdit === next.onCancelEdit &&
        prev.onResendEdit === next.onResendEdit,
);
