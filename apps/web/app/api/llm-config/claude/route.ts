import { NextRequest, NextResponse } from "next/server";
import { updateClaudeConfig } from "@kletron/server/services/llmConfigService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/claude
 * Update Claude (Anthropic) configuration
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
        const config = await updateClaudeConfig(body);

        // Mask the API key in response
        const sanitizedConfig = {
            ...config,
            claude: config.claude
                ? {
                    ...config.claude,
                    apiKey: config.claude.apiKey ? "••••••••" : "",
                }
                : undefined,
        };

        return NextResponse.json({ config: sanitizedConfig }, { status: 200 });
    } catch (error) {
        console.error("Error updating Claude config:", error);
        const message = error instanceof Error ? error.message : "Failed to update Claude configuration";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
