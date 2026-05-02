'use client';

import React, { useMemo } from 'react';
import { deriveActivityState, type ActivitySourceEvent } from '../../lib/agentActivity';
import { cn } from '../../lib/utils';

export interface AgentActivityStripProps {
    streaming: boolean;
    streamingText: string;
    streamingReasoning?: string;
    /** Latest events from the run (e.g. AgentEvent[] or ChatEvent[]). */
    events?: ActivitySourceEvent[];
    /** @deprecated Elapsed timer removed from UI — kept for API compatibility */
    runStartedAt?: string | null;
    className?: string;
}

/**
 * Single-line status while the agent runs (solid text — reliable across browsers).
 * Hidden while answer tokens stream to avoid duplicating the markdown preview.
 */
export const AgentActivityStrip: React.FC<AgentActivityStripProps> = ({
    streaming,
    streamingText,
    streamingReasoning,
    events = [],
    className = '',
}) => {
    const state = useMemo(
        () => deriveActivityState({ streaming, streamingText, streamingReasoning, events }),
        [streaming, streamingText, streamingReasoning, events],
    );

    if (!state) return null;
    /** Don’t duplicate the live answer stream with an “Answering…” line */
    if (streamingText.trim().length > 0) return null;

    return (
        <p
            className={cn(
                'ml-auto flex w-fit max-w-full flex-wrap items-baseline justify-end gap-x-1.5 gap-y-1 text-[11px] leading-snug',
                className,
            )}
            role="status"
            aria-live="polite"
        >
            <span className="font-medium text-text-muted">{state.label}</span>
            {state.detail ? (
                <>
                    <span className="select-none text-text-muted/45" aria-hidden>
                        ·
                    </span>
                    <span
                        className="max-w-[min(100%,14rem)] truncate rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] font-medium text-text-muted/90"
                        title={state.detail}
                    >
                        {state.detail}
                    </span>
                </>
            ) : null}
        </p>
    );
};
