import { NextRequest, NextResponse } from "next/server";
import { updateAzureEmbeddingConfig } from "@numezis/server/services/embeddingConfigService";
import { AzureEmbeddingConfigSchema } from "@numezis/shared/schemas/embeddingConfig.schema";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

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
