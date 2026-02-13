import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ThoughtsPanelProps {
    thoughts: string[];
    /** Explicitly mark as long-form reasoning (prose) vs discrete steps */
    isReasoning?: boolean;
    /** Override the default collapsed state */
    defaultExpanded?: boolean;
}

/**
 * Heuristic: treat as long-form prose when there's a single thought block
 * that is longer than ~200 chars, OR when explicitly flagged as reasoning.
 */
function isLongFormReasoning(thoughts: string[], isReasoning?: boolean): boolean {
    if (isReasoning) return true;
    if (thoughts.length === 1 && thoughts[0].length > 200) return true;
    // Multiple short lines that look like bullet points = steps
    if (thoughts.length <= 3 && thoughts.every(t => t.length > 120)) return true;
    return false;
}

export const ThoughtsPanel: React.FC<ThoughtsPanelProps> = ({
    thoughts = [],
    isReasoning = false,
    defaultExpanded = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const cleanedThoughts = useMemo(
        () => thoughts.map((t) => t.trim()).filter(Boolean),
        [thoughts],
    );
    const isProse = useMemo(
        () => isLongFormReasoning(cleanedThoughts, isReasoning),
        [cleanedThoughts, isReasoning],
    );

    if (cleanedThoughts.length === 0) return null;

    // Summary text shown in the collapsed header
    const headerSummary = isProse
        ? cleanedThoughts[0].slice(0, 80) + (cleanedThoughts[0].length > 80 ? '...' : '')
        : `${cleanedThoughts.length} step${cleanedThoughts.length > 1 ? 's' : ''}`;

    return (
        <div className="mb-1">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 text-left transition-all duration-150 group"
            >
                <div className="flex items-center justify-center shrink-0 text-text-muted/50">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <span className="text-[13px] font-medium text-text-muted group-hover:text-text-secondary transition-colors">
                    {isProse ? 'Thought' : 'Reasoning'} — {headerSummary}
                </span>
            </button>

            {isExpanded && (
                <div className="mt-1.5 pl-4 border-l-2 border-white/[0.06]">
                    {isProse ? (
                        <div className="text-[13px] text-text-muted/70 leading-relaxed whitespace-pre-wrap">
                            {cleanedThoughts.join('\n\n')}
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {cleanedThoughts.map((step, idx) => (
                                <div key={idx} className="flex gap-2 text-[12px]">
                                    <span className="shrink-0 text-text-muted/40 font-mono w-3 text-right select-none">
                                        {idx + 1}
                                    </span>
                                    <span className="text-text-muted/70 leading-relaxed">
                                        {step}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
