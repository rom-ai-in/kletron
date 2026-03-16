'use client';

import React, { useEffect, useRef, useMemo, useCallback, useLayoutEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { MessageBubble, SystemMessage } from './ChatMessage';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolInvocation } from './ToolInvocation';
import { ToolBatchAccordion } from './ToolBatchAccordion';
import type { ToolPair } from './ToolBatchAccordion';
import { ThoughtsPanel } from './ThoughtsPanel';
import type { ChatEvent, RenderItem } from '@numezis/shared/chatTypes';
import { groupEvents, pairToolEvents } from '../../lib/toolPairing';

// Re-export for backward compatibility
export type { ChatEvent, RenderItem };
export { groupEvents };

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

    const observerMapRef = useRef<Map<number, ResizeObserver>>(new Map());
    const nodeMapRef = useRef<Map<number, HTMLDivElement>>(new Map());

    const measureItem = useCallback((index: number, node: HTMLDivElement | null) => {
        // Clean up previous observer for this index
        const prevObserver = observerMapRef.current.get(index);
        const prevNode = nodeMapRef.current.get(index);
        if (prevNode && prevNode !== node && prevObserver) {
            prevObserver.disconnect();
            observerMapRef.current.delete(index);
            nodeMapRef.current.delete(index);
        }

        if (!node) return;

        // Initial measure
        const h = node.offsetHeight;
        const prev = itemHeightsRef.current.get(index);
        if (prev !== h) {
            itemHeightsRef.current.set(index, h);
            setMeasureVersion((v) => v + 1);
        }

        // Set up ResizeObserver for dynamic size changes (accordion collapse/expand)
        if (!observerMapRef.current.has(index) || nodeMapRef.current.get(index) !== node) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const newH = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height);
                    const cached = itemHeightsRef.current.get(index);
                    if (cached !== newH && newH > 0) {
                        itemHeightsRef.current.set(index, newH);
                        setMeasureVersion((v) => v + 1);
                    }
                }
            });
            observer.observe(node);
            observerMapRef.current.set(index, observer);
            nodeMapRef.current.set(index, node);
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

    useEffect(() => {
        if (isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [items, streaming]);

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
                        role={event.kind === 'error' ? 'system' : event.kind}
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
