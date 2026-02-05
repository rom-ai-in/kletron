import { NextRequest, NextResponse } from "next/server";
import { setProviderEnabled, getEnabledProviders } from "@numezis/server/services/llmConfigService";
import { LLM_PROVIDERS, type LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/llm-config/enable
 * Get list of enabled providers
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const enabledProviders = await getEnabledProviders();
        return NextResponse.json({ enabledProviders });
    } catch (error) {
        console.error("[GET /api/llm-config/enable] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get enabled providers" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/llm-config/enable
 * Enable or disable a provider
 * Body: { provider: string, enabled: boolean }
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { provider, enabled } = body;

        if (!provider || typeof enabled !== "boolean") {
            return NextResponse.json(
                { error: "provider (string) and enabled (boolean) are required" },
                { status: 400 }
            );
        }

        if (!LLM_PROVIDERS.includes(provider as LlmProviderType)) {
            return NextResponse.json(
                { error: `Invalid provider: ${provider}. Valid: ${LLM_PROVIDERS.join(", ")}` },
                { status: 400 }
            );
        }

        const updatedConfig = await setProviderEnabled(provider as LlmProviderType, enabled);

        return NextResponse.json({
            success: true,
            provider,
            enabled,
            enabledProviders: updatedConfig.enabledProviders,
        });
    } catch (error) {
        console.error("[POST /api/llm-config/enable] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update provider" },
            { status: 500 }
        );
    }
}
