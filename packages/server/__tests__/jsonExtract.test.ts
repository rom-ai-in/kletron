import { describe, it, expect } from 'vitest';
import { extractJsonObject, stripCodeFences, removeTrailingCommasOutsideStrings } from '@numezis/server/lib/jsonExtract';

describe('jsonExtract', () => {
    describe('stripCodeFences', () => {
        it('removes markdown json fences', () => {
            const input = '```json\n{"a":1}\n```';
            expect(stripCodeFences(input)).toBe('{"a":1}');
        });

        it('removes generic code fences', () => {
            const input = 'Here is code:\n```\n{"a":1}\n```';
            expect(stripCodeFences(input)).toBe('{"a":1}');
        });

        it('returns input if no fences', () => {
            expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
        });
    });

    describe('removeTrailingCommas', () => {
        it('removes trailing commas in arrays', () => {
            expect(removeTrailingCommasOutsideStrings('[1, 2,]')).toBe('[1, 2]');
        });
        it('removes trailing commas in objects', () => {
            expect(removeTrailingCommasOutsideStrings('{"a": 1,}')).toBe('{"a": 1}');
        });
        it('ignores commas inside strings', () => {
            expect(removeTrailingCommasOutsideStrings('{"a": "comma, here",}')).toBe('{"a": "comma, here"}');
        });
    });

    describe('extractJsonObject', () => {
        it('extracts simple json', () => {
            expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
        });

        it('extracts embedded json', () => {
            expect(extractJsonObject('prose before {"a":1} prose after')).toEqual({ a: 1 });
        });

        it('handles trailing commas via sanitation', () => {
            expect(extractJsonObject('{"a":1,}')).toEqual({ a: 1 });
        });

        it('handles newlines and weird spacing', () => {
            const input = `
            {
                "a": 1,
                "b": [
                    2,
                ]
            }
            `;
            expect(extractJsonObject(input)).toEqual({ a: 1, b: [2] });
        });

        it('throws on invalid json', () => {
            expect(() => extractJsonObject('not json')).toThrow();
        });
    });
});
