'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { MessageBubble, SystemMessage } from './ChatMessage';
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
        const isToolEvent = (event.kind === 'assistant' && Boolean(event.toolName)) || event.kind === 'tool';
        if (isToolEvent) {
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
    const pairs: ToolPair[] = [];
    let current: ToolPair = {};

    for (const e of events) {
        if (e.kind === 'assistant' && e.toolName) {
            if (current.call) pairs.push(current);
            current = { call: e };
        } else if (e.kind === 'tool') {
            current.result = e;
            pairs.push(current);
            current = {};
        }
    }
    if (current.call) pairs.push(current);
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
                    <div className="max-w-[90%] rounded-lg px-3 py-2 text-[12px] bg-transparent text-text-muted">
                        Working on it...
                    </div>
                </div>
            )}

            {footer}

            <div ref={bottomRef} />
        </div>
    );
};
