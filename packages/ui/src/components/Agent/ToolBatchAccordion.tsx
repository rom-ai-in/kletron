'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Loader2 } from 'lucide-react';
import { ToolInvocation } from './ToolInvocation';
import type { ChatEvent } from './MessageList';

export interface ToolPair {
    call?: ChatEvent;
    result?: ChatEvent;
}

export interface ToolBatchAccordionProps {
    pairs: ToolPair[];
    compact?: boolean;
}

export const ToolBatchAccordion: React.FC<ToolBatchAccordionProps> = ({ pairs, compact = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const hasRunning = pairs.some(p => !p.result);
    const errorCount = pairs.filter(p => p.result?.isError === true).length;

    // Unified summary: "X tools" or "X tools (Y failed)"
    let summaryText = `${pairs.length} tool${pairs.length === 1 ? '' : 's'}`;
    if (errorCount > 0) {
        summaryText += ` (${errorCount} failed)`;
    }

    return (
        <div className="mb-2 w-full max-w-[95%] rounded-lg border border-border-subtle bg-bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-200">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-state-hover transition-colors"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    {hasRunning
                        ? <Loader2 className="w-4 h-4 text-[var(--agent-running)] animate-spin" />
                        : <Wrench className="w-4 h-4 text-[var(--agent-tool)]" />
                    }
                    <span className="text-xs font-medium text-text-secondary">{summaryText}</span>
                </div>

                <div className="flex items-center gap-1.5 px-2">
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-border-subtle bg-bg-elevated/30 max-h-[300px] overflow-y-auto scrollbar-elegant p-2 space-y-2">
                    {pairs.map((pair, i) => (
                        <ToolInvocation
                            key={i}
                            name={pair.call?.toolName ?? pair.result?.toolName ?? 'tool'}
                            args={pair.call?.toolArgs}
                            output={pair.result?.toolOutput ?? pair.result?.content}
                            meta={pair.call?.timestamp}
                            compact={compact}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
