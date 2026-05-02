import { describe, expect, it } from 'vitest';
import {
    categorizeToolName,
    countToolCategories,
    formatCategorySummary,
} from '../toolCategories';

describe('categorizeToolName', () => {
    it('classifies known tools', () => {
        expect(categorizeToolName('read_file')).toBe('read');
        expect(categorizeToolName('execute_bash')).toBe('run');
        expect(categorizeToolName('write_file')).toBe('write');
        expect(categorizeToolName('search_code')).toBe('search');
        expect(categorizeToolName('web_search')).toBe('network');
    });

    it('strips MCP namespace', () => {
        expect(categorizeToolName('github__read_file')).toBe('read');
        expect(categorizeToolName('MyServer__execute_bash')).toBe('run');
    });
});

describe('formatCategorySummary', () => {
    it('includes category breakdown', () => {
        const counts = countToolCategories(['read_file', 'read_file', 'execute_bash']);
        expect(formatCategorySummary(3, counts)).toContain('Read 2');
        expect(formatCategorySummary(3, counts)).toContain('Run 1');
    });
});
