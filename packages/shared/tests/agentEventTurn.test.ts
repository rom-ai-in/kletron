import { describe, it, expect } from 'vitest';
import { lastPlainAssistantAfterLatestUser } from '../src/agentEventTurn';
import type { AgentEvent } from '../src/types';

const user = (id: string, content: string): AgentEvent => ({
    id,
    phaseId: 'user',
    kind: 'user',
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
});

const assistant = (id: string, content: string): AgentEvent => ({
    id,
    phaseId: 'n',
    kind: 'assistant',
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
});

describe('lastPlainAssistantAfterLatestUser', () => {
    it('returns assistant after the latest user, not an earlier assistant', () => {
        const events: AgentEvent[] = [
            user('u1', 'first'),
            assistant('a1', 'Answer one'),
            user('u2', 'second'),
            assistant('a2', 'Answer two partial'),
        ];
        expect(lastPlainAssistantAfterLatestUser(events)?.id).toBe('a2');
        expect(lastPlainAssistantAfterLatestUser(events)?.content).toBe('Answer two partial');
    });

    it('returns undefined when no plain assistant follows latest user', () => {
        const events: AgentEvent[] = [user('u1', 'hi'), assistant('a1', 'bye')];
        const onlyUser: AgentEvent[] = [user('u2', 'new turn')];
        expect(lastPlainAssistantAfterLatestUser(events)?.content).toBe('bye');
        expect(lastPlainAssistantAfterLatestUser(onlyUser)).toBeUndefined();
    });

    it('skips tool-call assistant rows', () => {
        const events: AgentEvent[] = [
            user('u1', 'run tool'),
            {
                id: 't1',
                phaseId: 'n',
                kind: 'assistant',
                role: 'assistant',
                name: 'some_tool',
                toolCallId: '1',
                content: '',
                timestamp: new Date().toISOString(),
            },
            assistant('a1', 'Final reply'),
        ];
        expect(lastPlainAssistantAfterLatestUser(events)?.id).toBe('a1');
    });
});
