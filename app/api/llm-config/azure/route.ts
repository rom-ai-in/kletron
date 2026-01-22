import { NextRequest, NextResponse } from "next/server";
import { updateAzureConfig } from "@/src/services/llmConfigService";
import { validateAzureConfig } from "@/src/schemas/llmConfig.schema";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/azure
 * Update Azure OpenAI configuration
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate the request body
        const azureConfig = validateAzureConfig(body);

        // Update in database
        const updatedConfig = await updateAzureConfig(azureConfig);

        return NextResponse.json(
            {
                message: "Azure OpenAI configuration updated successfully",
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

        console.error("Error updating Azure config:", error);
        return NextResponse.json(
            { error: "Failed to update Azure OpenAI configuration" },
            { status: 500 }
        );
    }
}
