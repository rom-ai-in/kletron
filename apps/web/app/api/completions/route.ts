import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { getChatModel } from "@kletron/server/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * POST /api/completions
 * 
 * Provides inline code completions for the Kletron IDE.
 * Takes code context (prefix/suffix) and returns AI-generated completion.
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
        const { prefix, suffix, language, file, cursorLine } = payload as {
            prefix: string;
            suffix: string;
            language: string;
            file: string;
            cursorLine: number;
        };

        if (!prefix || typeof prefix !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid 'prefix' field" },
                { status: 400 }
            );
        }

        // Prepare completion prompt
        const systemPrompt = `You are an AI code completion assistant integrated into an IDE. 
Your task is to predict and complete the code at the cursor position.

RULES:
1. Return ONLY the completion text - no explanations, no markdown, no code fences
2. Complete the current line or statement naturally
3. Match the existing code style (indentation, naming conventions)
4. Keep completions concise - typically 1-3 lines unless completing a function/block
5. Do not repeat any code from the prefix
6. If the context is ambiguous, provide a safe, minimal completion
7. Language: ${language || 'unknown'}

The user is editing: ${file || 'unknown file'}`;

        const userPrompt = `Complete the code at the cursor position (marked with <CURSOR>):

\`\`\`${language || ''}
${prefix}<CURSOR>${suffix.slice(0, 500)}
\`\`\`

Provide only the text that should be inserted at the cursor position:`;

        // Get LLM and generate completion
        const llm = await getChatModel();

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt),
        ]);

        const completion = typeof response.content === "string"
            ? response.content.trim()
            : "";

        // Clean up completion - remove any markdown artifacts
        let cleanedCompletion = completion
            .replace(/^```[\w]*\n?/, '')
            .replace(/\n?```$/, '')
            .replace(/^`+|`+$/g, '');

        // Truncate excessively long completions
        if (cleanedCompletion.length > 500) {
            const lastNewline = cleanedCompletion.lastIndexOf('\n', 500);
            cleanedCompletion = cleanedCompletion.slice(0, lastNewline > 0 ? lastNewline : 500);
        }

        return NextResponse.json({
            completion: cleanedCompletion,
            stopReason: "complete",
        });
    } catch (error: unknown) {
        console.error("[Completions API] Error:", error);
        return NextResponse.json(
            { error: (error as Error)?.message ?? "Completion generation failed" },
            { status: 500 }
        );
    }
}
