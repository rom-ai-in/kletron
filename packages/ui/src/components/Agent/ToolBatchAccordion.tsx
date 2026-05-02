'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Loader2 } from 'lucide-react';
import { ToolInvocation } from './ToolInvocation';
import type { ChatEvent } from './MessageList';
import { cn } from '../../lib/utils';
import {
    CATEGORY_ORDER,
    categoryLabel,
    categorizeToolName,
    countToolCategories,
    formatCategorySummary,
    type ToolCategory,
} from '../../lib/toolCategories';

export interface ToolPair {
    call?: ChatEvent;
    result?: ChatEvent;
}

export interface ToolBatchAccordionProps {
    pairs: ToolPair[];
    compact?: boolean;
}

function toolNameFromPair(p: ToolPair): string | undefined {
    return p.call?.toolName ?? p.result?.toolName;
}

export const ToolBatchAccordion: React.FC<ToolBatchAccordionProps> = ({ pairs, compact = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const hasRunning = pairs.some((p) => !p.result);
    const errorCount = pairs.filter((p) => p.result?.isError === true).length;

    const categoryCounts = useMemo(
        () => countToolCategories(pairs.map((p) => toolNameFromPair(p))),
        [pairs],
    );

    const summaryCore = formatCategorySummary(pairs.length, categoryCounts);
    const failureSuffix = errorCount > 0 ? ` (${errorCount} failed)` : '';

    const grouped = useMemo(() => {
        const map = new Map<ToolCategory, ToolPair[]>();
        for (const cat of CATEGORY_ORDER) map.set(cat, []);
        for (const p of pairs) {
            const cat = categorizeToolName(toolNameFromPair(p));
            map.get(cat)!.push(p);
        }
        return map;
    }, [pairs]);

    const title = `${summaryCore}${failureSuffix}`;

    return (
        <div className="mt-2.5 mb-2 w-full max-w-[95%]">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    'group inline-flex w-full max-w-full items-center gap-2 rounded-md px-1 py-0.5 -mx-1 text-left',
                    'transition-colors duration-150',
                    'hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/35 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-app',
                )}
                aria-expanded={isExpanded}
                title={title}
            >
                <span className="flex shrink-0 items-center justify-center text-[var(--agent-tool)] transition-transform duration-200 group-hover:scale-105">
                    {hasRunning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--agent-running)]" aria-hidden />
                    ) : (
                        <Wrench className="h-3.5 w-3.5" aria-hidden />
                    )}
                </span>

                <span className="min-w-0 flex-1 text-[11px] leading-snug sm:text-xs">
                    <span
                        className={cn(
                            'font-medium',
                            hasRunning && 'text-text-secondary animate-pulse',
                            !hasRunning && 'text-text-secondary',
                        )}
                    >
                        {summaryCore}
                    </span>
                    {failureSuffix ? (
                        <span className="font-medium tabular-nums text-status-error-text/90">{failureSuffix}</span>
                    ) : null}
                </span>

                <span className="flex shrink-0 items-center text-text-muted/70 transition-colors group-hover:text-text-muted">
                    {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                </span>
            </button>

            {isExpanded && (
                <div className="mt-2 max-h-[360px] space-y-3 overflow-y-auto border-l border-border-subtle/50 pl-3 scrollbar-elegant">
                    {CATEGORY_ORDER.map((cat) => {
                        const sectionPairs = grouped.get(cat) ?? [];
                        if (sectionPairs.length === 0) return null;
                        return (
                            <div key={cat}>
                                <div className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted/80">
                                    {categoryLabel(cat)} · {sectionPairs.length}
                                </div>
                                <div className="space-y-2">
                                    {sectionPairs.map((pair, i) => (
                                        <ToolInvocation
                                            key={`${cat}-${i}`}
                                            name={pair.call?.toolName ?? pair.result?.toolName ?? 'tool'}
                                            args={pair.call?.toolArgs}
                                            output={pair.result?.toolOutput ?? pair.result?.content}
                                            meta={pair.call?.timestamp}
                                            compact={compact}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
