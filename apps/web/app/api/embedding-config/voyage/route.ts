import { NextRequest, NextResponse } from "next/server";
import { updateVoyageEmbeddingConfig } from "@kletron/server/services/embeddingConfigService";
import { validateVoyageEmbeddingConfig } from "@kletron/shared/schemas/embeddingConfig.schema";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export async function PUT(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validated = validateVoyageEmbeddingConfig(body);
        const updated = await updateVoyageEmbeddingConfig(validated);

        // Mask API key in response
        if (updated.voyage?.apiKey) {
            updated.voyage.apiKey = "•".repeat(8) + updated.voyage.apiKey.slice(-4);
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update Voyage embedding config:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update configuration" },
            { status: 400 }
        );
    }
}
