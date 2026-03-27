import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { getChatModel } from "@kletron/server/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * POST /api/git/commit-message
 * 
 * Generates a conventional commit message from a git diff
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
        const { diff } = payload as { diff: string };

        if (!diff || typeof diff !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid 'diff' field" },
                { status: 400 }
            );
        }

        const systemPrompt = `You are an expert at writing git commit messages following the Conventional Commits specification.

RULES:
1. Format: <type>(<scope>): <description>
2. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
3. Scope is optional, use it for the affected component/module
4. Description should be imperative mood, present tense ("add" not "added")
5. Keep the first line under 72 characters
6. Add a blank line before body if needed
7. Body should explain what and why, not how
8. Return ONLY the commit message - no explanations or markdown`;

        const userPrompt = `Generate a commit message for this diff:

\`\`\`diff
${diff.slice(0, 6000)}
\`\`\`

Return only the commit message:`;

        const llm = await getChatModel();

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt),
        ]);

        let message = typeof response.content === "string"
            ? response.content.trim()
            : "";

        // Clean up any markdown artifacts
        message = message.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').replace(/^`+|`+$/g, '');

        return NextResponse.json({ message });
    } catch (error: unknown) {
        console.error("[Git Commit Message API] Error:", error);
        return NextResponse.json(
            { error: (error as Error)?.message ?? "Failed to generate commit message" },
            { status: 500 }
        );
    }
}
