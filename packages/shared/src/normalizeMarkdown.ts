// ─── Markdown Normalization ─────────────────────────────────────────────────
// Converts raw LLM-produced markdown into canonical GFM style.
// Can be used client-side or server-side before persistence.
//
// Uses unified (remark) pipeline + Prettier for consistent formatting.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";

/**
 * Normalizes a raw markdown string to ensure canonical GitHub Flavored Markdown style.
 *
 * This enforces:
 * - Unordered lists always use `-`
 * - Ordered lists always use `.`
 * - Emphasis always uses `*`
 * - Fenced code blocks always use backticks
 * - Code blocks are always fenced
 * - Bullet list items use minimal indentation
 *
 * @param input Raw markdown string from an LLM
 * @returns Normalized markdown string
 */
export async function normalizeMarkdown(input: string): Promise<string> {
    try {
        const file = await unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkStringify, {
                bullet: "-",
                bulletOrdered: ".",
                emphasis: "*",
                fence: "`",
                fences: true,
                listItemIndent: "one",
            })
            .process(input);

        return String(file);
    } catch (e) {
        // Fallback to raw string if parsing or formatting fails
        console.error("Markdown normalization failed:", e);
        return input;
    }
}
