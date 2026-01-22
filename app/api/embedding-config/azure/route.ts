import { NextRequest, NextResponse } from "next/server";
import { updateAzureEmbeddingConfig } from "@/src/services/embeddingConfigService";
import { AzureEmbeddingConfigSchema } from "@/src/schemas/embeddingConfig.schema";

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate the incoming config
        const parseResult = AzureEmbeddingConfigSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: "Invalid Azure embedding configuration",
                    details: parseResult.error.errors
                },
                { status: 400 }
            );
        }

        const config = await updateAzureEmbeddingConfig(parseResult.data);

        // Mask API key in response
        const maskedConfig = {
            ...config,
            azure: config.azure ? {
                ...config.azure,
                apiKey: "••••••••",
            } : undefined,
        };

        return NextResponse.json(maskedConfig);
    } catch (error) {
        console.error("Failed to update Azure embedding config:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update Azure embedding configuration" },
            { status: 500 }
        );
    }
}
