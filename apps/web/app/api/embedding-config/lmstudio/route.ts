import { NextRequest, NextResponse } from "next/server";
import { updateLMStudioEmbeddingConfig } from "@numezis/server/services/embeddingConfigService";
import { LMStudioEmbeddingConfigSchema } from "@numezis/shared/schemas/embeddingConfig.schema";
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
        const parseResult = LMStudioEmbeddingConfigSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: "Invalid LM Studio embedding configuration",
                    details: parseResult.error.errors
                },
                { status: 400 }
            );
        }

        const config = await updateLMStudioEmbeddingConfig(parseResult.data);

        // Mask API key in response
        const maskedConfig = {
            ...config,
            lmstudio: config.lmstudio ? {
                ...config.lmstudio,
                apiKey: config.lmstudio.apiKey ? "••••••••" : undefined,
            } : undefined,
        };

        return NextResponse.json(maskedConfig);
    } catch (error) {
        console.error("Failed to update LM Studio embedding config:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update LM Studio embedding configuration" },
            { status: 500 }
        );
    }
}
