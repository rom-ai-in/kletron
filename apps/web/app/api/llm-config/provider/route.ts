import { NextRequest, NextResponse } from "next/server";
import { updateDefaultProvider } from "@kletron/server/services/llmConfigService";
import { z } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

const ProviderSchema = z.object({
    provider: z.enum(["azure", "openai", "claude", "gemini", "lmstudio", "ollama", "vllm"]),
});

/**
 * PUT /api/llm-config/provider
 * Update default LLM provider
 */
export async function PUT(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();

        // Validate the request body
        const { provider } = ProviderSchema.parse(body);

        // Update in database
        const updatedConfig = await updateDefaultProvider(provider);

        return NextResponse.json(
            {
                message: "Default provider updated successfully",
                config: updatedConfig
            },
            { status: 200 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: error.errors
                },
                { status: 400 }
            );
        }

        console.error("Error updating default provider:", error);
        return NextResponse.json(
            { error: "Failed to update default provider" },
            { status: 500 }
        );
    }
}
