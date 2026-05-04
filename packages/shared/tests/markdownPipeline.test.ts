/**
 * Unit tests for the markdown / content sanitization pipeline.
 *
 * Covers:
 * 1. sanitizeVisibleAssistantContent — code block preservation
 * 2. extractThoughtsFromContent — thought extraction
 * 3. normalizeMessage — combined pipeline
 * 4. normalizeMarkdown — GFM normalization
 */

import { describe, it, expect } from 'vitest';
import {
    sanitizeVisibleAssistantContent,
    extractThoughtsFromContent,
    normalizeMessage,
    containsMetaLeakage,
    stripSystemPrefix,
} from '../src/contentSanitizer';
import { normalizeMarkdown } from '../src/normalizeMarkdown';

// ═══════════════════════════════════════════════════════════════════════════════
// sanitizeVisibleAssistantContent
// ═══════════════════════════════════════════════════════════════════════════════

describe('sanitizeVisibleAssistantContent', () => {
    it('returns empty string for empty input', () => {
        expect(sanitizeVisibleAssistantContent('')).toBe('');
        expect(sanitizeVisibleAssistantContent(null as any)).toBe('');
    });

    it('passes through normal content unchanged', () => {
        const content = 'Here is the code you asked for:\n\nDone!';
        expect(sanitizeVisibleAssistantContent(content)).toBe(content);
    });

    it('strips <think> blocks', () => {
        const content = '<think>Internal reasoning</think>\n\nVisible content';
        expect(sanitizeVisibleAssistantContent(content)).toBe('Visible content');
    });

    it('filters meta-reasoning paragraphs', () => {
        const content = 'we must obey policy and follow the rules.\n\nHere is the actual answer.';
        const result = sanitizeVisibleAssistantContent(content);
        expect(result).toBe('Here is the actual answer.');
        expect(result).not.toContain('we must obey policy');
    });

    it('preserves fenced code blocks with internal blank lines', () => {
        const content = 'Here is the code:\n\n```python\ndef foo():\n    pass\n\n\ndef bar():\n    return 42\n```\n\nDone!';
        const result = sanitizeVisibleAssistantContent(content);
        expect(result).toContain('```python');
        expect(result).toContain('def foo():');
        expect(result).toContain('def bar():');
        expect(result).toContain('```');
    });

    it('preserves tilde-fenced code blocks', () => {
        const content = '~~~js\nconst x = 1;\n\nconst y = 2;\n~~~';
        const result = sanitizeVisibleAssistantContent(content);
        expect(result).toContain('~~~js');
        expect(result).toContain('const x = 1');
    });

    it('deduplicates long paragraphs ≥80 chars', () => {
        const longParagraph = 'A'.repeat(100);
        const content = `${longParagraph}\n\n${longParagraph}\n\nFinal.`;
        const result = sanitizeVisibleAssistantContent(content);
        // Should keep only one copy of the long paragraph
        const count = (result.match(new RegExp(longParagraph, 'g')) ?? []).length;
        expect(count).toBe(1);
        expect(result).toContain('Final.');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// extractThoughtsFromContent
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractThoughtsFromContent', () => {
    it('returns empty thoughts for simple content', () => {
        const result = extractThoughtsFromContent('Hello, world!');
        expect(result.content).toBe('Hello, world!');
        expect(result.thoughts).toHaveLength(0);
    });

    it('extracts <think> blocks', () => {
        const result = extractThoughtsFromContent('<think>Planning steps...</think>\n\nHere is the answer.');
        expect(result.content).toBe('Here is the answer.');
        expect(result.thoughts).toContain('Planning steps...');
    });

    it('extracts Final: markers', () => {
        const result = extractThoughtsFromContent('Reasoning about the problem...\n\nFinal: The answer is 42.');
        expect(result.content).toBe('The answer is 42.');
        expect(result.thoughts.length).toBeGreaterThan(0);
    });

    it('returns empty content and thoughts when content is empty', () => {
        const result = extractThoughtsFromContent('');
        expect(result.content).toBe('');
        expect(result.thoughts).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeMessage
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeMessage', () => {
    it('leaves non-assistant messages unchanged', () => {
        const msg = { id: '1', role: 'user' as const, content: 'Hello', thoughts: [], timestamp: new Date().toISOString() };
        expect(normalizeMessage(msg)).toBe(msg);
    });

    it('sanitizes assistant messages and extracts thoughts', () => {
        const msg = {
            id: '2',
            role: 'assistant' as const,
            content: '<think>reasoning</think>\n\nHere is the answer.',
            timestamp: new Date().toISOString(),
        };
        const result = normalizeMessage(msg);
        expect(result.content).toBe('Here is the answer.');
    });

    it('preserves existing thoughts', () => {
        const msg = {
            id: '3',
            role: 'assistant' as const,
            content: 'Hello',
            thoughts: ['existing thought'],
            timestamp: new Date().toISOString(),
        };
        const result = normalizeMessage(msg);
        expect(result.thoughts).toEqual(['existing thought']);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════════════════════

describe('containsMetaLeakage', () => {
    it('detects meta-reasoning patterns', () => {
        expect(containsMetaLeakage('we must obey policy and rules')).toBe(true);
        expect(containsMetaLeakage('Hello, this is normal content')).toBe(false);
    });
});

describe('stripSystemPrefix', () => {
    it('strips [System: ...] prefix', () => {
        const text = '[System: personality setup]\n\nActual user message';
        expect(stripSystemPrefix(text)).toBe('Actual user message');
    });

    it('leaves normal text unchanged', () => {
        expect(stripSystemPrefix('Hello')).toBe('Hello');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeMarkdown
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeMarkdown', () => {
    it('normalizes list markers to dashes', async () => {
        const input = '* item one\n* item two';
        const result = await normalizeMarkdown(input);
        expect(result).toContain('- item one');
        expect(result).toContain('- item two');
    });

    it('preserves fenced code blocks', async () => {
        const input = '```js\nconst x = 1;\n```';
        const result = await normalizeMarkdown(input);
        expect(result).toContain('```js');
        expect(result).toContain('const x = 1;');
    });

    it('returns input on failure', async () => {
        // Should not throw, should return input
        const result = await normalizeMarkdown('simple text');
        expect(result).toContain('simple text');
    });
});
