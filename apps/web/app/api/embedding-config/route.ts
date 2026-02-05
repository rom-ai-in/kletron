import { NextRequest, NextResponse } from "next/server";
import { updateDefaultEmbeddingProvider, getEmbeddingConfig, resetEmbeddingToEnvConfig } from "@numezis/server/services/embeddingConfigService";
import { EMBEDDING_PROVIDERS, EmbeddingProviderType } from "@numezis/shared/schemas/embeddingConfig.schema";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const config = await getEmbeddingConfig();

        // Mask API keys for security
        const maskedConfig = {
            ...config,
            azure: config.azure ? {
                ...config.azure,
                apiKey: config.azure.apiKey ? "•".repeat(8) + config.azure.apiKey.slice(-4) : undefined,
            } : undefined,
            openai: config.openai ? {
                ...config.openai,
                apiKey: config.openai.apiKey ? "•".repeat(8) + config.openai.apiKey.slice(-4) : undefined,
            } : undefined,
            voyage: config.voyage ? {
                ...config.voyage,
                apiKey: config.voyage.apiKey ? "•".repeat(8) + config.voyage.apiKey.slice(-4) : undefined,
            } : undefined,
            gemini: config.gemini ? {
                ...config.gemini,
                apiKey: config.gemini.apiKey ? "•".repeat(8) + config.gemini.apiKey.slice(-4) : undefined,
            } : undefined,
            lmstudio: config.lmstudio ? {
                ...config.lmstudio,
                apiKey: config.lmstudio.apiKey ? "•".repeat(8) + config.lmstudio.apiKey.slice(-4) : undefined,
            } : undefined,
            ollama: config.ollama,
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
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { provider } = body;

        if (!provider || !EMBEDDING_PROVIDERS.includes(provider as EmbeddingProviderType)) {
            return NextResponse.json(
                { error: `Invalid provider. Must be one of: ${EMBEDDING_PROVIDERS.join(", ")}` },
                { status: 400 }
            );
        }

        const config = await updateDefaultEmbeddingProvider(provider as EmbeddingProviderType);
        return NextResponse.json(config);
    } catch (error) {
        console.error("Failed to switch embedding provider:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to switch embedding provider" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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
