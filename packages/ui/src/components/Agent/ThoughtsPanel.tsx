import React, { useState, useMemo } from 'react';
import { Brain, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

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
        <div className="mb-1.5 border border-border-subtle rounded-md overflow-hidden bg-bg-elevated/60">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-state-hover transition-colors"
            >
                <div className="flex items-center justify-center w-4 h-4 rounded text-text-muted shrink-0">
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
                <div className="flex items-center gap-1.5 text-text-muted min-w-0">
                    {isProse ? <Sparkles size={12} className="shrink-0" /> : <Brain size={12} className="shrink-0" />}
                    <span className="text-[10px] font-medium tracking-wide truncate">
                        {isProse ? 'Thought' : 'Reasoning'} — {headerSummary}
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="px-3 pb-2 pt-0.5 border-t border-border-subtle">
                    {isProse ? (
                        /* Long-form prose — render as continuous text like ChatGPT / Cursor */
                        <div className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                            {cleanedThoughts.join('\n\n')}
                        </div>
                    ) : (
                        /* Discrete steps — compact list without heavy checkmark icons */
                        <div className="space-y-0.5 mt-0.5">
                            {cleanedThoughts.map((step, idx) => (
                                <div key={idx} className="flex gap-2 text-[10px] group">
                                    <span className="shrink-0 text-text-muted/60 font-mono w-3 text-right select-none">
                                        {idx + 1}
                                    </span>
                                    <span className="text-text-secondary leading-snug">
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
