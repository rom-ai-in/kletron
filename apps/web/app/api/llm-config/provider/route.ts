import { NextRequest, NextResponse } from "next/server";
import { updateDefaultProvider } from "@kletron/server/services/llmConfigService";
import { z } from "zod";
import { requireAppRouteAdmin } from "@kletron/server/lib/auth/adminAuth";

export const dynamic = "force-dynamic";

const ProviderSchema = z.object({
    provider: z.enum(["azure", "openai", "codex", "claude", "gemini", "vertex", "lmstudio", "ollama", "vllm"]),
});

/**
 * PUT /api/llm-config/provider
 * Update default LLM provider
 */
export async function PUT(request: NextRequest) {
    const admin = await requireAppRouteAdmin(request);
    if (!admin.ok) {
        return new Response(JSON.stringify({ error: admin.error }), {
            status: admin.status,
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
