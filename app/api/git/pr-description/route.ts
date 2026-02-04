import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";
import { getChatModel } from "@/src/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * POST /api/git/pr-description
 * 
 * Generates a comprehensive PR description from a git diff
 */
export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const payload = await request.json();
        const { diff, title } = payload as { diff: string; title?: string };

        if (!diff || typeof diff !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid 'diff' field" },
                { status: 400 }
            );
        }

        const systemPrompt = `You are an expert at writing clear, comprehensive Pull Request descriptions.

FORMAT:
## Summary
Brief 1-2 sentence description of the change.

## Changes
- Bullet point list of key changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How to test these changes.

RULES:
1. Be concise but comprehensive
2. Focus on what and why, not how
3. Use present tense
4. Return only the PR description in Markdown format`;

        const userPrompt = `Generate a PR description for this diff${title ? ` with title "${title}"` : ''}:

\`\`\`diff
${diff.slice(0, 10000)}
\`\`\`

Return only the PR description in Markdown:`;

        const llm = await getChatModel();

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt),
        ]);

        let description = typeof response.content === "string"
            ? response.content.trim()
            : "";

        return NextResponse.json({ description });
    } catch (error: unknown) {
        console.error("[Git PR Description API] Error:", error);
        return NextResponse.json(
            { error: (error as Error)?.message ?? "Failed to generate PR description" },
            { status: 500 }
        );
    }
}
