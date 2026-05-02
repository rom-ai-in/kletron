'use client';

import React, { useMemo } from 'react';
import { deriveActivityState, type ActivitySourceEvent } from '../../lib/agentActivity';

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
 * Single line of muted status text while the agent runs. No borders, chips, or timers.
 * Hidden while answer text is streaming (the markdown stream is the status).
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

    const text = state.detail ? `${state.label} · ${state.detail}` : state.label;

    return (
        <p
            className={`text-[11px] text-text-muted/90 ${className}`.trim()}
            role="status"
            aria-live="polite"
        >
            {text}
        </p>
    );
};
