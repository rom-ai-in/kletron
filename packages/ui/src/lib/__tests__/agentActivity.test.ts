import { describe, expect, it } from 'vitest';
import { deriveActivityState, formatActivityElapsed } from '../agentActivity';

describe('deriveActivityState', () => {
    it('returns null when not streaming', () => {
        expect(deriveActivityState({ streaming: false, streamingText: '', events: [] })).toBeNull();
    });

    it('prefers answering when text is present', () => {
        expect(deriveActivityState({ streaming: true, streamingText: 'hello', events: [] })?.label).toBe('Answering…');
    });

    it('shows tool detail from last tool-like event', () => {
        const s = deriveActivityState({
            streaming: true,
            streamingText: '',
            events: [
                { kind: 'user' },
                { kind: 'assistant', toolName: 'read_file' },
            ],
        });
        expect(s?.label).toBe('Using tools…');
        expect(s?.detail).toContain('read_file');
    });

    it('shows working on it when streaming but no events yet', () => {
        expect(deriveActivityState({ streaming: true, streamingText: '', events: [] })?.label).toBe('Working on it…');
    });

    it('shows thinking when reasoning stream is present but no answer text', () => {
        expect(
            deriveActivityState({
                streaming: true,
                streamingText: '',
                streamingReasoning: 'step one',
                events: [],
            })?.label,
        ).toBe('Thinking…');
    });

    it('shows continuing when last event is a non-tool assistant reply (server-side poll)', () => {
        expect(
            deriveActivityState({
                streaming: true,
                streamingText: '',
                events: [
                    { kind: 'user', content: 'hi' },
                    { kind: 'assistant', content: 'Here is a longer partial answer from the model.' },
                ],
            })?.label,
        ).toBe('Continuing…');
    });
});

describe('formatActivityElapsed', () => {
    it('formats seconds', () => {
        const past = new Date(Date.now() - 42_000).toISOString();
        expect(formatActivityElapsed(past)).toMatch(/42s/);
    });
});
