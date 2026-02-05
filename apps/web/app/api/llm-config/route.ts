import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig, resetToDefaultConfig, updateDefaultProvider } from "@numezis/server/services/llmConfigService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { LLM_PROVIDERS, type LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/llm-config
 * Retrieve the current LLM configuration (with masked API keys)
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const config = await getLlmConfig();

        // Don't expose sensitive keys in full - mask all API keys
        const sanitizedConfig = {
            ...config,
            azure: config.azure
                ? {
                    ...config.azure,
                    apiKey: config.azure.apiKey ? "••••••••" : "",
                }
                : undefined,
            openai: config.openai
                ? {
                    ...config.openai,
                    apiKey: config.openai.apiKey ? "••••••••" : "",
                }
                : undefined,
            claude: config.claude
                ? {
                    ...config.claude,
                    apiKey: config.claude.apiKey ? "••••••••" : "",
                }
                : undefined,
            gemini: config.gemini
                ? {
                    ...config.gemini,
                    apiKey: config.gemini.apiKey ? "••••••••" : "",
                }
                : undefined,
            lmstudio: config.lmstudio
                ? {
                    ...config.lmstudio,
                    apiKey: config.lmstudio.apiKey ? "••••••••" : "",
                }
                : undefined,
            ollama: config.ollama ?? undefined,
        };

        return NextResponse.json(sanitizedConfig, { status: 200 });
    } catch (error) {
        console.error("Error fetching LLM config:", error);
        return NextResponse.json(
            { error: "Failed to fetch LLM configuration" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/llm-config
 * Update the default provider
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const body = await req.json();

        if (body.provider) {
            // Validate provider is one of the supported types
            if (!LLM_PROVIDERS.includes(body.provider as LlmProviderType)) {
                return NextResponse.json(
                    { error: `Invalid provider. Must be one of: ${LLM_PROVIDERS.join(", ")}` },
                    { status: 400 }
                );
            }
            const config = await updateDefaultProvider(body.provider as LlmProviderType);
            return NextResponse.json(config, { status: 200 });
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    } catch (error) {
        console.error("Error updating LLM config:", error);
        return NextResponse.json(
            { error: "Failed to update LLM configuration" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/llm-config
 * Reset configuration to defaults (no provider secrets)
 */
export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const config = await resetToDefaultConfig();
        return NextResponse.json(config, { status: 200 });
    } catch (error) {
        console.error("Error resetting LLM config:", error);
        return NextResponse.json(
            { error: "Failed to reset LLM configuration" },
            { status: 500 }
        );
    }
}
