import { NextRequest, NextResponse } from "next/server";
import { updateLMStudioConfig } from "@/src/services/llmConfigService";
import { validateLMStudioConfig } from "@/src/schemas/llmConfig.schema";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/lmstudio
 * Update LM Studio configuration
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate the request body
        const lmstudioConfig = validateLMStudioConfig(body);

        // Update in database
        const updatedConfig = await updateLMStudioConfig(lmstudioConfig);

        return NextResponse.json(
            {
                message: "LM Studio configuration updated successfully",
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

        console.error("Error updating LM Studio config:", error);
        return NextResponse.json(
            { error: "Failed to update LM Studio configuration" },
            { status: 500 }
        );
    }
}
