import { NextRequest, NextResponse } from "next/server";
import { updateOllamaEmbeddingConfig } from "@/src/services/embeddingConfigService";
import { validateOllamaEmbeddingConfig } from "@/src/schemas/embeddingConfig.schema";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function PUT(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validated = validateOllamaEmbeddingConfig(body);
        const updated = await updateOllamaEmbeddingConfig(validated);

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update Ollama embedding config:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update configuration" },
            { status: 400 }
        );
    }
}
