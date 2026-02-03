import { NextRequest, NextResponse } from "next/server";
import { updateOllamaConfig } from "@/src/services/llmConfigService";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/ollama
 * Update Ollama configuration
 */
export async function PUT(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const config = await updateOllamaConfig(body);

        return NextResponse.json({ config }, { status: 200 });
    } catch (error) {
        console.error("Error updating Ollama config:", error);
        const message = error instanceof Error ? error.message : "Failed to update Ollama configuration";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
