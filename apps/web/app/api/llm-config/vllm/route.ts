import { NextRequest, NextResponse } from "next/server";
import { updateVLLMConfig } from "@numezis/server/services/llmConfigService";
import { validateVLLMConfig } from "@numezis/shared/schemas/llmConfig.schema";
import { z } from "zod";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/vllm
 * Update vLLM configuration
 */
export async function PUT(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();

        // Validate the request body
        const vllmConfig = validateVLLMConfig(body);

        // Update in database
        const updatedConfig = await updateVLLMConfig(vllmConfig);

        return NextResponse.json(
            {
                message: "vLLM configuration updated successfully",
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

        console.error("Error updating vLLM config:", error);
        return NextResponse.json(
            { error: "Failed to update vLLM configuration" },
            { status: 500 }
        );
    }
}
