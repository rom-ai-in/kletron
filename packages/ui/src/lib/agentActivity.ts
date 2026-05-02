/**
 * Derives a single-line activity description for the agent chat (no protocol changes).
 */

export type ActivitySourceEvent = {
    kind: string;
    toolName?: string;
    name?: string;
    /** Optional — used to infer “Continuing…” when the run is still active */
    content?: string;
};

export function deriveActivityState(input: {
    streaming: boolean;
    streamingText: string;
    /** Live reasoning stream — show “Thinking…” when present but no answer text yet */
    streamingReasoning?: string;
    events: ActivitySourceEvent[];
}): { label: string; detail?: string } | null {
    if (!input.streaming) return null;
    const t = input.streamingText.trim();
    if (t.length > 0) {
        return { label: 'Answering…' };
    }
    if (input.streamingReasoning?.trim()) {
        return { label: 'Thinking…' };
    }
    const ev = input.events;
    if (ev.length === 0) {
        return { label: 'Working on it…' };
    }
    for (let i = ev.length - 1; i >= 0; i--) {
        const e = ev[i];
        const tool = e.toolName ?? e.name;
        if (e.kind === 'tool' || (e.kind === 'assistant' && tool)) {
            const raw = String(tool ?? 'tool');
            const short = raw.length > 36 ? `${raw.slice(0, 33)}…` : raw;
            return { label: 'Using tools…', detail: short };
        }
    }
    const last = ev[ev.length - 1];
    const tail =
        typeof last?.content === 'string' ? last.content.trim() : '';
    if (last?.kind === 'assistant' && !last.toolName && !last.name && tail.length > 20) {
        return { label: 'Continuing…' };
    }
    return { label: 'Working on it…' };
}

export function formatActivityElapsed(iso: string | null | undefined): string | undefined {
    if (!iso) return undefined;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return undefined;
    const ms = Date.now() - t;
    if (ms < 0) return undefined;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m${(s % 60).toString().padStart(2, '0')}s`;
}
