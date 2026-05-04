'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Loader2 } from 'lucide-react';
import { ToolInvocation } from './ToolInvocation';
import type { ChatEvent } from './MessageList';
import { cn } from '../../lib/utils';
import { AgentStatusShimmerLabel } from './AgentStatusShimmerLabel';
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
        <div className="mt-2.5 mb-2 w-full max-w-[min(100%,42rem)]">
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] shadow-[inset_0_1px_0_0_var(--border-subtle)]">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        'group flex w-full items-center gap-2.5 px-2.5 py-2 text-left',
                        'transition-colors duration-150 hover:bg-white/[0.03]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
                    )}
                    aria-expanded={isExpanded}
                    title={title}
                >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] text-[var(--agent-tool)] transition-colors group-hover:border-white/[0.1]">
                        {hasRunning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--agent-running)]" aria-hidden />
                        ) : (
                            <Wrench className="h-3.5 w-3.5 opacity-90" aria-hidden />
                        )}
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Tools</div>
                        <div className="mt-0.5 font-mono text-[11px] leading-snug text-text-secondary sm:text-[12px]">
                            <AgentStatusShimmerLabel active={hasRunning}>{summaryCore}</AgentStatusShimmerLabel>
                            {failureSuffix ? (
                                <span className="font-medium tabular-nums text-status-error-text/90">{failureSuffix}</span>
                            ) : null}
                        </div>
                    </div>

                    <span className="flex shrink-0 items-center rounded-md border border-transparent px-1 py-0.5 text-text-muted transition-colors group-hover:border-white/[0.06] group-hover:text-text-secondary">
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden strokeWidth={2} />
                        ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden strokeWidth={2} />
                        )}
                    </span>
                </button>

                {isExpanded && (
                    <div className="max-h-[360px] space-y-3 overflow-y-auto border-t border-white/[0.06] bg-black/[0.15] px-2.5 py-2.5 scrollbar-elegant">
                        {CATEGORY_ORDER.map((cat) => {
                            const sectionPairs = grouped.get(cat) ?? [];
                            if (sectionPairs.length === 0) return null;
                            return (
                                <div key={cat}>
                                    <div className="mb-1.5 flex items-center gap-2">
                                        <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">
                                            {categoryLabel(cat)}
                                        </span>
                                        <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[9px] font-mono tabular-nums text-text-muted">
                                            {sectionPairs.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {sectionPairs.map((pair, i) => (
                                            <ToolInvocation
                                                key={`${cat}-${i}`}
                                                name={pair.call?.toolName ?? pair.result?.toolName ?? 'tool'}
                                                args={pair.call?.toolArgs}
                                                output={pair.result?.toolOutput ?? pair.result?.content}
                                                meta={pair.call?.timestamp}
                                                compact={compact}
                                                className={compact ? '' : 'w-full'}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
