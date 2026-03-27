import { NextRequest, NextResponse } from "next/server";
import { updateOpenAIConfig } from "@kletron/server/services/llmConfigService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/openai
 * Update OpenAI configuration
 */
export async function PUT(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const config = await updateOpenAIConfig(body);

        // Mask the API key in response
        const sanitizedConfig = {
            ...config,
            openai: config.openai
                ? {
                    ...config.openai,
                    apiKey: config.openai.apiKey ? "••••••••" : "",
                }
                : undefined,
        };

        return NextResponse.json({ config: sanitizedConfig }, { status: 200 });
    } catch (error) {
        console.error("Error updating OpenAI config:", error);
        const message = error instanceof Error ? error.message : "Failed to update OpenAI configuration";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
