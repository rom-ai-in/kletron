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
// “Thought — …” lead-ins (Qwen / LM Studio and similar) — peel off before visible reply.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detects `Thought — …`, `Thinking: …`, `Réflexion — …` prefixes often emitted in the same
 * token stream as the user-visible answer. Splits internal reasoning from the reply when a
 * clear answer anchor is found (French/English openers, headings, tables).
 *
 * When no anchor exists yet (streaming partial), returns the tail after the marker as
 * `leadInThought` and empty `rest` so callers can hide the preview until the answer starts.
 */
export function splitThoughtDashLeadIn(content: string): { leadInThought: string | null; rest: string } {
    const trimmed = content.trimStart();
    const marker = /^(Thought|Thinking|Réflexion|Pensée)\s*[—–\-:\u2013]\s*/i;
    const mm = marker.exec(trimmed);
    if (!mm) {
        return { leadInThought: null, rest: content };
    }

    const afterMarker = trimmed.slice(mm[0].length);
    if (!afterMarker.trim()) {
        return { leadInThought: null, rest: content };
    }

    /** Marks where the user-facing portion begins (first match by lowest index). */
    /** JS `\b` is ASCII-centric — trailing accents (é, à) break it; use lookahead instead. */
    const edge = '(?=\\s|$|[.,;:!?]|\\n)';
    const answerStarts: RegExp[] = [
        /\bVoici\b/i,
        /\bMerci\b/i,
        /\bOui,\s+on\b/i,
        /\bNon,\s/i,
        new RegExp(`J['\u2019]ai\\s+trouvé${edge}`, 'i'),
        new RegExp(`J['\u2019]ai\\s+identifié${edge}`, 'i'),
        new RegExp(`J['\u2019]ai\\s+enregistré${edge}`, 'i'),
        new RegExp(`Voilà${edge}`, 'i'),
        new RegExp(`Résumé${edge}`, 'i'),
        new RegExp(`Pour\\s+résumer${edge}`, 'i'),
        /\bHere(?:'s|'re|\s+is|\s+are)\b/i,
        /\bThe\s+(?:following|table|codes?|answer|list|results?)\b/i,
        /\bBelow\s+is\b/i,
        /^#{1,3}\s+/m,
        /^\*\*\s*[A-Za-zÀ-ÿ]/m,
        /\n\|\s*[^\n|]+\s*\|\s*[^\n|]+\s*\|\s*\r?\n\s*\|[-:\s|]+\|/m,
    ];

    let cut = -1;
    for (const re of answerStarts) {
        const found = afterMarker.match(re);
        if (!found || found.index === undefined) continue;
        const idx = found.index;
        if (idx >= 10 && (cut === -1 || idx < cut)) {
            cut = idx;
        }
    }

    if (cut > 0) {
        const thought = afterMarker.slice(0, cut).trim();
        const visible = afterMarker.slice(cut).trim();
        if (visible.length >= 8) {
            return { leadInThought: thought, rest: visible };
        }
    }

    const nn = afterMarker.indexOf('\n\n');
    if (nn >= 12) {
        return {
            leadInThought: afterMarker.slice(0, nn).trim(),
            rest: afterMarker.slice(nn).trim(),
        };
    }

    // Prefix matched but no visible answer yet — treat remainder as in-progress thought only.
    return { leadInThought: afterMarker.trim(), rest: '' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Thought extraction — splits assistant content into visible + reasoning parts.
// ═══════════════════════════════════════════════════════════════════════════════

export function extractThoughtsFromContent(content: string): { content: string; thoughts: string[] } {
    if (!content) {
        return { content, thoughts: [] };
    }

    const thoughts: string[] = [];
    let cleaned = content;

    /** When `Thought —` matched but no answer anchor yet — do not promote that text to visible body. */
    let dashLeadInNoAnswer = false;
    const dashSplit = splitThoughtDashLeadIn(cleaned);
    if (dashSplit.leadInThought) {
        thoughts.push(dashSplit.leadInThought);
        cleaned = dashSplit.rest;
        if (!cleaned.trim()) dashLeadInNoAnswer = true;
    }

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

    // Extract explicit thinking blocks: long `redacted_thinking` XML first, then short `think` tags.
    const longThink = /<redacted_thinking>([\s\S]*?)<\/redacted_thinking>/gi;
    let m: RegExpExecArray | null;
    while ((m = longThink.exec(cleaned)) !== null) {
        addThoughts(m[1]);
    }
    cleaned = cleaned.replace(longThink, "").trim();

    const shortThink = /<think>([\s\S]*?)<\/think>/gi;
    while ((m = shortThink.exec(cleaned)) !== null) {
        addThoughts(m[1]);
    }
    cleaned = cleaned.replace(shortThink, "").trim();

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

    // Heuristic: if an *early* paragraph looks like planning, split it into thoughts.
    // Require 3+ paragraphs so two-paragraph answers (common from small models) are not
    // reclassified when the final message is normalized (avoids visible "jump" vs stream).
    const cueRegex = /\b(we need to|we should|we have|the user|user wants|goal|plan|approach|next step|tool|call|let's|i will)\b/i;
    const paragraphs = cleaned.split(/\n\s*\n/);
    if (paragraphs.length >= 3) {
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

    // If sanitization removed all visible content but we captured thoughts,
    // preserve the last thought as visible content so the message isn't hidden.
    // This commonly happens with thinking models (e.g. Gemma) that wrap their
    // entire response in `think` or `redacted_thinking` XML tags.
    // Skip when the only capture was an orphan `Thought —` lead-in (nothing user-facing).
    if (!cleaned.trim() && thoughts.length > 0 && !dashLeadInNoAnswer) {
        cleaned = thoughts[thoughts.length - 1];
    }

    return { content: cleaned, thoughts };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Visible content sanitization — strips meta-reasoning paragraphs.
// ═══════════════════════════════════════════════════════════════════════════════

/** Strip closed `redacted_thinking` and `think` XML blocks (matching open/close tag names). */
function stripCompletedThinkingTagBlocks(text: string): string {
    return text
        .replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi, " ")
        .replace(/<think>[\s\S]*?<\/think>/gi, " ");
}

/**
 * Progressive assistant stream (token deltas): strip thinking tags and meta text
 * before rendering markdown, so users don't see chain-of-thought or echoed context.
 *
 * We intentionally do **not** truncate on an unclosed thinking opener: models often
 * stream the opening tag before the body and close tag, which would blank the whole
 * answer until the close arrives (severe flicker). A brief partial tag may show until
 * the block completes; closed blocks are stripped immediately.
 */
export function sanitizeAssistantStreamPreview(raw: string): string {
    if (!raw?.trim()) return "";
    let t = raw.replace(/\r\n/g, "\n");
    t = stripCompletedThinkingTagBlocks(t);
    // Stray half-tags common while streaming
    t = t.replace(/<\/?redacted_thinking>/gi, " ");
    t = t.replace(/<\/?think>/gi, " ");
    t = t.trim();

    const dash = splitThoughtDashLeadIn(t);
    if (dash.leadInThought !== null && !dash.rest.trim()) {
        return '';
    }
    if (dash.leadInThought !== null && dash.rest.trim()) {
        t = dash.rest.trim();
    }

    return sanitizeVisibleAssistantContent(t.trim());
}

export function sanitizeVisibleAssistantContent(content: string): string {
    if (!content) return "";
    const paragraphs = stripCompletedThinkingTagBlocks(content)
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

    let working = msg.content;
    const prefixThoughts: string[] = [];
    const dash = splitThoughtDashLeadIn(working);
    if (dash.leadInThought) {
        prefixThoughts.push(dash.leadInThought);
        working = dash.rest;
    }

    const visibleContent = sanitizeVisibleAssistantContent(working);
    if (!visibleContent) {
        return {
            ...msg,
            content: "",
            thoughts: [...(msg.thoughts ?? []), ...prefixThoughts],
        };
    }

    if (msg.thoughts && msg.thoughts.length > 0) {
        if (prefixThoughts.length === 0) return msg;
        return {
            ...msg,
            content: visibleContent,
            thoughts: [...msg.thoughts, ...prefixThoughts],
        };
    }

    const extracted = extractThoughtsFromContent(visibleContent);
    const allThoughts = [...prefixThoughts, ...extracted.thoughts];
    if (allThoughts.length === 0) {
        return { ...msg, content: visibleContent };
    }
    return {
        ...msg,
        content: extracted.content,
        thoughts: allThoughts,
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
