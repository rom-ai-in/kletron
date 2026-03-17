import { NextRequest, NextResponse } from "next/server";
import { updateGeminiEmbeddingConfig } from "@kletron/server/services/embeddingConfigService";
import { validateGeminiEmbeddingConfig } from "@kletron/shared/schemas/embeddingConfig.schema";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export async function PUT(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validated = validateGeminiEmbeddingConfig(body);
        const updated = await updateGeminiEmbeddingConfig(validated);

        // Mask API key in response
        if (updated.gemini?.apiKey) {
            updated.gemini.apiKey = "•".repeat(8) + updated.gemini.apiKey.slice(-4);
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update Gemini embedding config:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update configuration" },
            { status: 400 }
        );
    }
}
