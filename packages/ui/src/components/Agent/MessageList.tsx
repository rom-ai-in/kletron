'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
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
}

export const MessageList: React.FC<MessageListProps> = ({
    events,
    renderItems: externalRenderItems,
    messageActions,
    streaming,
    streamingText,
    compactTools = false,
    className,
    footer,
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);

    const items = useMemo(
        () => externalRenderItems ?? groupEvents(events),
        [events, externalRenderItems],
    );

    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }, []);

    useEffect(() => {
        if (isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [items, streaming]);

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn('flex-1 overflow-y-auto p-2 scrollbar-elegant', className)}
        >
            <div className="space-y-2">
                {items.map((item, index) => {
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

                    // System message
                    if (event.kind === 'system') {
                        return <SystemMessage key={event.id || `sys-${index}`} content={event.content || ''} />;
                    }

                    // Skip tool messages (already handled above)
                    if (event.kind === 'tool') return null;

                    const isAssistant = event.kind === 'assistant';

                    return (
                        <div key={event.id || `msg-${index}`} className={event.toolName ? 'mb-0' : 'mb-1'}>
                            {/* Thoughts panel (assistant only) */}
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

                            {/* Message bubble */}
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
                })}
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
