import { NextRequest, NextResponse } from "next/server";
import { updateGeminiConfig } from "@kletron/server/services/llmConfigService";
import { requireAppRouteAdmin } from "@kletron/server/lib/auth/adminAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/gemini
 * Update Google Gemini configuration
 */
export async function PUT(req: NextRequest) {
    try {
        const admin = await requireAppRouteAdmin(req);
        if (!admin.ok) {
            return new Response(JSON.stringify({ error: admin.error }), {
                status: admin.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const config = await updateGeminiConfig(body);

        // Mask the API key in response
        const sanitizedConfig = {
            ...config,
            gemini: config.gemini
                ? {
                    ...config.gemini,
                    apiKey: config.gemini.apiKey ? "••••••••" : "",
                }
                : undefined,
        };

        return NextResponse.json({ config: sanitizedConfig }, { status: 200 });
    } catch (error) {
        console.error("Error updating Gemini config:", error);
        const message = error instanceof Error ? error.message : "Failed to update Gemini configuration";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
