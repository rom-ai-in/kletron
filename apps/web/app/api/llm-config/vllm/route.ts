import { NextRequest, NextResponse } from "next/server";
import { updateVLLMConfig } from "@kletron/server/services/llmConfigService";
import { validateVLLMConfig } from "@kletron/shared/schemas/llmConfig.schema";
import { z } from "zod";
import { requireAppRouteAdmin } from "@kletron/server/lib/auth/adminAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/vllm
 * Update vLLM configuration
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
