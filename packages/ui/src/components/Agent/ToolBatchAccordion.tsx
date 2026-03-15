'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
    const hasRunning = pairs.some(p => !p.result);
    const hasError = pairs.some(p => p.result?.isError === true);

    // Auto collapse logic: expanded by default if running or error, collapsed if all success
    const [isExpanded, setIsExpanded] = useState(hasRunning || hasError);

    // Effect to auto-collapse when batch finishes successfully
    useEffect(() => {
        if (!hasRunning && !hasError) {
            setIsExpanded(false);
        } else if (hasRunning || hasError) {
            setIsExpanded(true);
        }
    }, [hasRunning, hasError]);

    const runningCount = pairs.filter(p => !p.result).length;
    const successCount = pairs.filter(p => p.result && p.result.isError !== true).length;
    const errorCount = pairs.filter(p => p.result?.isError === true).length;

    let summaryText = `Used ${pairs.length} tool${pairs.length === 1 ? '' : 's'}`;
    let icon = <CheckCircle2 className="w-4 h-4 text-[var(--agent-success)]" />;

    if (hasRunning) {
        summaryText = `Executing ${runningCount} tool${runningCount === 1 ? '' : 's'}...`;
        icon = <Loader2 className="w-4 h-4 text-[var(--agent-running)] animate-spin" />;
    } else if (hasError) {
        summaryText = `${errorCount} tool${errorCount === 1 ? '' : 's'} failed`;
        icon = <XCircle className="w-4 h-4 text-[var(--agent-error)]" />;
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
                    {icon}
                    <span className="text-xs font-medium text-text-secondary">{summaryText}</span>
                </div>

                <div className="flex items-center gap-1.5 px-2">
                    {successCount > 0 && hasRunning && (
                        <span className="text-[10px] text-[var(--agent-success)] font-medium">✓ {successCount}</span>
                    )}
                    {errorCount > 0 && hasRunning && (
                        <span className="text-[10px] text-[var(--agent-error)] font-medium">✗ {errorCount}</span>
                    )}

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
