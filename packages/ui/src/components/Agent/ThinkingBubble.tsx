'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
        <div className={`py-2 ${className}`}>
            {/* Minimal text indicator */}
            <button
                onClick={content ? handleToggle : undefined}
                className={`flex items-center gap-2 text-left ${content ? 'cursor-pointer' : 'cursor-default'}`}
            >
                {/* Animated dot */}
                {isActive && (
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-text-muted/40" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-text-muted/60" />
                    </span>
                )}

                {/* Summary text — simple muted label */}
                <span className={`text-[15px] font-medium text-text-muted ${isActive ? 'animate-pulse' : 'opacity-60'}`}>
                    {summary}
                </span>

                {/* Expand chevron if content exists */}
                {content && (
                    isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-text-muted/50" />
                        : <ChevronRight className="w-3.5 h-3.5 text-text-muted/50" />
                )}
            </button>

            {/* Expandable content */}
            {content && isExpanded && (
                <div className="mt-2 pl-4 border-l-2 border-white/[0.06]">
                    <p className="text-[12px] text-text-muted/60 whitespace-pre-wrap leading-relaxed">
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
