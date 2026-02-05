'use client';

import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

export interface ThinkingBubbleProps {
    /** Whether the AI is currently thinking */
    isActive?: boolean;
    /** Summary text shown in header */
    summary?: string;
    /** Full thinking content */
    content?: string;
    /** Whether the content is expanded */
    defaultExpanded?: boolean;
    /** Callback when expand state changes */
    onExpandChange?: (expanded: boolean) => void;
    className?: string;
}

export function ThinkingBubble({
    isActive = false,
    summary = 'Thinking...',
    content,
    defaultExpanded = false,
    onExpandChange,
    className = '',
}: ThinkingBubbleProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const handleToggle = () => {
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        onExpandChange?.(newExpanded);
    };

    return (
        <div
            className={`rounded-lg overflow-hidden transition-all
        border bg-[var(--agent-thinking-bg)]
        ${isActive
                    ? 'border-[var(--agent-thinking-border)]'
                    : 'border-[var(--agent-thinking-border)] opacity-80'
                }
        ${className}
      `}
        >
            {/* Header */}
            <button
                onClick={handleToggle}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--agent-thinking-bg)]"
            >
                {/* Brain icon with animation */}
                <Brain
                    className={`w-4 h-4 text-[var(--agent-thinking)] ${isActive ? 'animate-pulse' : ''}`}
                />

                {/* Summary text */}
                <span className="flex-1 text-xs font-medium text-[var(--agent-thinking-text)]">
                    {summary}
                </span>

                {/* Loading indicator when active */}
                {isActive && (
                    <Loader2 className="w-3 h-3 text-[var(--agent-thinking)] animate-spin" />
                )}

                {/* Expand/collapse chevron */}
                {content && (
                    isExpanded
                        ? <ChevronDown className="w-3 h-3 text-[var(--agent-thinking-text)]" />
                        : <ChevronRight className="w-3 h-3 text-[var(--agent-thinking-text)]" />
                )}
            </button>

            {/* Expandable content */}
            {content && isExpanded && (
                <div className="px-3 pb-2 border-t border-[var(--agent-thinking-border)] pt-2">
                    <p className="text-[11px] text-[var(--agent-thinking-text)] opacity-70 whitespace-pre-wrap">
                        {content}
                    </p>
                </div>
            )}
        </div>
    );
}

// Convenience component for multiple thoughts
export interface ThoughtItem {
    id: string;
    summary: string;
    content?: string;
    timestamp?: string;
}

export interface ThinkingListProps {
    thoughts: ThoughtItem[];
    activeThoughtId?: string;
    className?: string;
}

export function ThinkingList({ thoughts, activeThoughtId, className = '' }: ThinkingListProps) {
    return (
        <div className={`space-y-2 ${className}`}>
            {thoughts.map((thought) => (
                <ThinkingBubble
                    key={thought.id}
                    isActive={thought.id === activeThoughtId}
                    summary={thought.summary}
                    content={thought.content}
                />
            ))}
        </div>
    );
}
