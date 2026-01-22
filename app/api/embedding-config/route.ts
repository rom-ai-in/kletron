import { NextRequest, NextResponse } from "next/server";
import { updateDefaultEmbeddingProvider, getEmbeddingConfig, resetEmbeddingToEnvConfig } from "@/src/services/embeddingConfigService";

export async function GET() {
    try {
        const config = await getEmbeddingConfig();

        // Mask API keys for security
        const maskedConfig = {
            ...config,
            azure: config.azure ? {
                ...config.azure,
                apiKey: config.azure.apiKey ? "••••••••" : undefined,
            } : undefined,
            lmstudio: config.lmstudio ? {
                ...config.lmstudio,
                apiKey: config.lmstudio.apiKey ? "••••••••" : undefined,
            } : undefined,
        };

        return NextResponse.json(maskedConfig);
    } catch (error) {
        console.error("Failed to get embedding config:", error);
        return NextResponse.json(
            { error: "Failed to get embedding configuration" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { provider } = body;

        if (!provider || (provider !== "azure" && provider !== "lmstudio")) {
            return NextResponse.json(
                { error: "Invalid provider selection" },
                { status: 400 }
            );
        }

        const config = await updateDefaultEmbeddingProvider(provider);
        return NextResponse.json(config);
    } catch (error) {
        console.error("Failed to switch embedding provider:", error);
        return NextResponse.json(
            { error: "Failed to switch embedding provider" },
            { status: 500 }
        );
    }
}

export async function DELETE() {
    try {
        const config = await resetEmbeddingToEnvConfig();
        return NextResponse.json({ success: true, config });
    } catch (error) {
        console.error("Failed to reset embedding config:", error);
        return NextResponse.json(
            { error: "Failed to reset embedding configuration" },
            { status: 500 }
        );
    }
}
