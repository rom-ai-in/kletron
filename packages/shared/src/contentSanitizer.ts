// ─── Content Sanitization ─────────────────────────────────────────────────────
// Consolidated from:
//  - packages/ui/src/hooks/useSessionStream.ts (extractThoughtsFromContent, sanitizeVisibleAssistantContent, normalizeMessage)
//  - packages/server/src/services/titleSanitizer.ts (META_REASONING_PATTERNS)
//  - apps/web/app/api/sessions/[id]/route.ts (inline leakedMetaPattern)
//
// Single source of truth for all content sanitization across client + server.

import type { Message } from './chatTypes';

// ═══════════════════════════════════════════════════════════════════════════════
// Meta-reasoning patterns — sentences leaked from LLM internal reasoning.
// ═══════════════════════════════════════════════════════════════════════════════

export const META_REASONING_PATTERNS: RegExp[] = [
    /\bwe must obey policy\b/i,
    /\bfinal answer in ["']?final["']? channel\b/i,
    /\bwe should provide a thorough analysis\b/i,
    /\bwe need to include the analysis and final answer\b/i,
    /\bthe user wrote\b/i,
    /\bnow,\s*we need to determine\b/i,
    /\bnow,\s*final answer\b/i,
    /\bnow,\s*the user wants to know\b/i,
    /\bgiven the pattern\b/i,
    /\bapproval required\b/i,
    /\bwe can proceed to output a final answer\b/i,
    /\bthe user asked to\b/i,
    /\bwe must not make further tool calls\b/i,
    /\bcopy-?paste exactly\b/i,
    /\bthis should satisfy the user request\b/i,
    /\bprovide (a )?structured analysis\b/i,
    /\bproceed to final\b/i,
    /\brespond with only the title\b/i,
    /\bwe need to produce a short chat title\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// Thought extraction — splits assistant content into visible + reasoning parts.
// ═══════════════════════════════════════════════════════════════════════════════

export function extractThoughtsFromContent(content: string): { content: string; thoughts: string[] } {
    if (!content) {
        return { content, thoughts: [] };
    }

    const thoughts: string[] = [];
    let cleaned = content;

    const addThoughts = (block: string) => {
        const lines = block
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const bulletLines = lines.filter((line) => /^([-*]|\d+\.|\d+\))\s+/.test(line));
        if (bulletLines.length > 0) {
            bulletLines.forEach((line) => {
                thoughts.push(line.replace(/^([-*]|\d+\.|\d+\))\s+/, "").trim());
            });
            return;
        }
        if (lines.length > 1) {
            thoughts.push(...lines);
            return;
        }
        if (block.trim()) {
            thoughts.push(block.trim());
        }
    };

    // Extract explicit <think> blocks
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let match: RegExpExecArray | null;
    while ((match = thinkRegex.exec(cleaned)) !== null) {
        addThoughts(match[1]);
    }
    cleaned = cleaned.replace(thinkRegex, "").trim();

    // Split on explicit Final/Answer markers
    const finalRegex = /(?:^|\n)\s*(final|answer)\s*:\s*/i;
    const finalMatch = cleaned.match(finalRegex);
    if (finalMatch && finalMatch.index !== undefined) {
        const before = cleaned.slice(0, finalMatch.index).trim();
        const after = cleaned.slice(finalMatch.index + finalMatch[0].length).trim();
        if (after && before) {
            addThoughts(before);
            cleaned = after;
        }
    }

    // Heuristic: if first paragraph looks like reasoning, split it out
    const cueRegex = /\b(we need to|we should|we have|the user|user wants|goal|plan|approach|next step|tool|call|let's|i will)\b/i;
    const paragraphs = cleaned.split(/\n\s*\n/);
    if (paragraphs.length >= 2) {
        const first = paragraphs[0].trim();
        const rest = paragraphs.slice(1).join("\n\n").trim();
        if (rest && cueRegex.test(first)) {
            addThoughts(first);
            cleaned = rest;
        }
    }

    // Guardrail: if policy/prompt-like leakage is present, hide it from visible content.
    if (/\brespond with only the title\b/i.test(cleaned) || /\bshort chat title\b/i.test(cleaned)) {
        addThoughts(cleaned);
        cleaned = "";
    }

    if (!cleaned.trim() && thoughts.length > 0) {
        cleaned = "";
    }

    return { content: cleaned, thoughts };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Visible content sanitization — strips meta-reasoning paragraphs.
// ═══════════════════════════════════════════════════════════════════════════════

export function sanitizeVisibleAssistantContent(content: string): string {
    if (!content) return "";
    const paragraphs = content
        .replace(/<think>[\s\S]*?<\/think>/gi, " ")
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!paragraphs.length) return "";

    const seen = new Set<string>();
    const kept: string[] = [];
    for (const paragraph of paragraphs) {
        if (META_REASONING_PATTERNS.some((pattern) => pattern.test(paragraph))) {
            continue;
        }
        const key = paragraph.replace(/\s+/g, " ").trim().toLowerCase();
        if (key.length >= 80 && seen.has(key)) continue;
        if (key.length >= 80) seen.add(key);
        kept.push(paragraph);
    }
    return kept.join("\n\n").trim();
}

/**
 * Check if a raw string contains meta-reasoning leakage that should be hidden.
 */
export function containsMetaLeakage(text: string): boolean {
    return META_REASONING_PATTERNS.some((p) => p.test(text));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Message normalization — combines sanitization + thought extraction.
// ═══════════════════════════════════════════════════════════════════════════════

export function normalizeMessage(msg: Message): Message {
    if (msg.role !== 'assistant' || !msg.content) return msg;
    const visibleContent = sanitizeVisibleAssistantContent(msg.content);
    if (!visibleContent) {
        return {
            ...msg,
            content: "",
            thoughts: msg.thoughts ?? [],
        };
    }
    if (msg.thoughts && msg.thoughts.length > 0) return msg;
    const extracted = extractThoughtsFromContent(visibleContent);
    if (extracted.thoughts.length === 0) return msg;
    return {
        ...msg,
        content: extracted.content,
        thoughts: extracted.thoughts,
    };
}

/**
 * Strip injected [System: ...] personality prefix from user messages or titles.
 */
export function stripSystemPrefix(text: string): string {
    if (text.startsWith("[System:") && text.indexOf("]\n\n") !== -1) {
        return text.slice(text.indexOf("]\n\n") + 3).trim();
    }
    return text;
}
