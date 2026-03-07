'use client';

import React, { useEffect, useRef, useMemo, useCallback, useLayoutEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { MessageBubble, SystemMessage } from './ChatMessage';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolInvocation } from './ToolInvocation';
import { ThoughtsPanel } from './ThoughtsPanel';

/* ═══════════════════════════════════════════════════════════════════════════
 * Types
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ChatEvent {
    id: string;
    kind: 'user' | 'assistant' | 'tool' | 'system';
    content?: string;
    toolName?: string;
    toolArgs?: string;
    toolOutput?: string;
    toolCallId?: string;
    thoughts?: string[];
    thinking?: string;
    timestamp?: string;
    /** Opaque index for edit controls — passed through to actions slot */
    messageIndex?: number;
}

export type RenderItem =
    | { type: 'event'; event: ChatEvent }
    | { type: 'tools'; events: ChatEvent[] };

/* ═══════════════════════════════════════════════════════════════════════════
 * Helpers — detect tool call vs tool result events.
 * Handles BOTH new data (AI tool-call → kind="assistant") and legacy data
 * (AI tool-call → kind="tool" with toolArgs and empty content).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Is this an AI message that issues a tool call (vs a tool result)? */
function isToolCallEvent(e: ChatEvent): boolean {
    // New format: assistant events with tool info
    if (e.kind === 'assistant' && Boolean(e.toolName)) return true;
    // Legacy format: kind="tool" with toolArgs and no meaningful content
    if (e.kind === 'tool' && e.toolArgs && !e.content?.trim()) return true;
    return false;
}

/** Is this a tool-related event (call or result)? */
function isToolRelatedEvent(e: ChatEvent): boolean {
    if (isToolCallEvent(e)) return true;
    if (e.kind === 'tool') return true;
    return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * groupEvents — pairs consecutive tool call / result events, separates
 * user and assistant text messages.
 * ═══════════════════════════════════════════════════════════════════════════ */

export function groupEvents(events: ChatEvent[]): RenderItem[] {
    const items: RenderItem[] = [];
    let toolBuffer: ChatEvent[] = [];

    const flushTools = () => {
        if (toolBuffer.length > 0) {
            items.push({ type: 'tools', events: toolBuffer });
            toolBuffer = [];
        }
    };

    for (const event of events) {
        if (isToolRelatedEvent(event)) {
            toolBuffer.push(event);
            continue;
        }
        flushTools();
        items.push({ type: 'event', event });
    }
    flushTools();
    return items;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * pairToolEvents — given a buffer of tool events, pair each assistant call
 * with its corresponding tool result.
 * ═══════════════════════════════════════════════════════════════════════════ */

interface ToolPair {
    call?: ChatEvent;
    result?: ChatEvent;
}

function pairToolEvents(events: ChatEvent[]): ToolPair[] {
    // Separate calls from results
    const calls: ChatEvent[] = [];
    const results: ChatEvent[] = [];
    for (const e of events) {
        if (isToolCallEvent(e)) calls.push(e);
        else results.push(e);
    }

    const pairs: ToolPair[] = [];
    const usedResults = new Set<number>();

    for (const call of calls) {
        // Try to match by toolCallId first, then by toolName
        let matchIdx = -1;
        if (call.toolCallId) {
            matchIdx = results.findIndex((r, i) => !usedResults.has(i) && r.toolCallId === call.toolCallId);
        }
        if (matchIdx === -1 && call.toolName) {
            matchIdx = results.findIndex((r, i) => !usedResults.has(i) && r.toolName === call.toolName);
        }
        if (matchIdx === -1) {
            // Grab the first unused result as a fallback
            matchIdx = results.findIndex((_, i) => !usedResults.has(i));
        }
        if (matchIdx >= 0) {
            usedResults.add(matchIdx);
            pairs.push({ call, result: results[matchIdx] });
        } else {
            pairs.push({ call });
        }
    }

    // Any unmatched results become their own pairs
    for (let i = 0; i < results.length; i++) {
        if (!usedResults.has(i)) {
            pairs.push({ result: results[i] });
        }
    }

    return pairs;
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
}

const MessageListInner: React.FC<MessageListProps> = ({
    events,
    renderItems: externalRenderItems,
    messageActions,
    streaming,
    streamingText,
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
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const previousScrollHeightRef = useRef<number | null>(null);
    const previousScrollTopRef = useRef<number>(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [measureVersion, setMeasureVersion] = useState(0);
    const itemHeightsRef = useRef<Map<number, number>>(new Map());
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
            const h = itemHeightsRef.current.get(i) ?? estimatedItemHeight;
            heights[i] = h;
            y += h;
        }
        return { starts, heights, totalHeight: y };
    }, [items, measureVersion]);

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
        if (!virtualized || items.length === 0) {
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
    }, [virtualized, items.length, scrollTop, viewportHeight, findStartIndex, offsets.starts, offsets.heights]);

    const measureItem = useCallback((index: number, node: HTMLDivElement | null) => {
        if (!node) return;
        const h = node.offsetHeight;
        const prev = itemHeightsRef.current.get(index);
        if (prev !== h) {
            itemHeightsRef.current.set(index, h);
            setMeasureVersion((v) => v + 1);
        }
    }, []);

    useEffect(() => {
        if (isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [items, streaming]);

    const renderMessageItem = useCallback((item: RenderItem, index: number) => {
        if (item.type === 'tools') {
            const pairs = pairToolEvents(item.events);
            return (
                <div key={`tools-${index}`}>
                    {pairs.map((pair, i) => (
                        <ToolInvocation
                            key={`tools-${index}-${i}`}
                            name={pair.call?.toolName ?? pair.result?.toolName ?? 'tool'}
                            args={pair.call?.toolArgs}
                            output={pair.result?.toolOutput ?? pair.result?.content}
                            meta={pair.call?.timestamp}
                            compact={compactTools}
                        />
                    ))}
                </div>
            );
        }

        const event = item.event;

        if (event.kind === 'system') {
            return <SystemMessage key={event.id || `sys-${index}`} content={event.content || ''} />;
        }

        if (event.kind === 'tool') return null;

        const isAssistant = event.kind === 'assistant';

        return (
            <div key={event.id || `msg-${index}`} className={event.toolName ? 'mb-0' : 'mb-1'}>
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

                {event.content && (
                    <MessageBubble
                        role={event.kind}
                        content={event.content}
                        timestamp={event.timestamp}
                        actions={messageActions?.(event)}
                    />
                )}
            </div>
        );
    }, [compactTools, messageActions]);

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
                {virtualized && items.length > 0 ? (
                    <div style={{ position: 'relative', height: offsets.totalHeight }}>
                        {items.slice(virtualizationWindow.startIndex, virtualizationWindow.endIndex + 1).map((item, localIndex) => {
                            const index = virtualizationWindow.startIndex + localIndex;
                            const top = offsets.starts[index] ?? 0;
                            return (
                                <div
                                    key={`virtual-${index}`}
                                    ref={(node) => measureItem(index, node)}
                                    style={{ position: 'absolute', top, left: 0, right: 0 }}
                                >
                                    {renderMessageItem(item, index)}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div key={`plain-${index}`} ref={(node) => measureItem(index, node)}>
                            {renderMessageItem(item, index)}
                        </div>
                    ))
                )}
            </div>

            {streaming && (
                <div className="flex justify-start mt-1">
                    {streamingText ? (
                        /* Progressive text — show accumulated tokens with a blinking cursor */
                        <div className="w-full rounded-lg px-3 py-2 text-[12px] bg-transparent text-text-secondary">
                            <MarkdownRenderer content={streamingText} />
                            <span className="inline-block w-[2px] h-[14px] bg-text-muted align-text-bottom ml-0.5 animate-pulse" />
                        </div>
                    ) : (
                        /* No text yet — show minimal "thinking" indicator */
                        <div className="max-w-[90%] rounded-lg px-3 py-2 text-[12px] bg-transparent text-text-muted flex items-center gap-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" />
                            Working on it...
                        </div>
                    )}
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
        prev.onNearTop === next.onNearTop,
);
