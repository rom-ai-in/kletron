import { NextRequest, NextResponse } from "next/server";
import { updateOpenAIEmbeddingConfig } from "@/src/services/embeddingConfigService";
import { validateOpenAIEmbeddingConfig } from "@/src/schemas/embeddingConfig.schema";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function PUT(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validated = validateOpenAIEmbeddingConfig(body);
        const updated = await updateOpenAIEmbeddingConfig(validated);

        // Mask API key in response
        if (updated.openai?.apiKey) {
            updated.openai.apiKey = "•".repeat(8) + updated.openai.apiKey.slice(-4);
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update OpenAI embedding config:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update configuration" },
            { status: 400 }
        );
    }
}
