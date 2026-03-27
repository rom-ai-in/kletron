import { NextRequest, NextResponse } from "next/server";
import { updateAzureConfig } from "@kletron/server/services/llmConfigService";
import { validateAzureConfig } from "@kletron/shared/schemas/llmConfig.schema";
import { z } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/azure
 * Update Azure OpenAI configuration
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
