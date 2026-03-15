import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import prettier from "prettier";

/**
 * Normalizes a raw markdown string to ensure canonical GitHub Flavored Markdown style.
 * Uses unified (remark-parse -> remark-gfm -> remark-stringify) followed by Prettier formatting.
 *
 * This enforces:
 * - Unordered lists always use `-`
 * - Ordered lists always use `.`
 * - Emphasis always uses `*`
 * - Fenced code blocks always use `\``
 * - Code blocks are always fenced (`fences: true`)
 * - Bullet list items use minimal indentation (`listItemIndent: "one"`)
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

        return await prettier.format(String(file), {
            parser: "markdown",
            proseWrap: "preserve",
        });
    } catch (e) {
        // Fallback to raw string if parsing or formatting fails
        console.error("Markdown normalization failed:", e);
        return input;
    }
}
