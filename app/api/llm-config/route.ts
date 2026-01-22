import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig, resetToEnvConfig } from "@/src/services/llmConfigService";

export const dynamic = "force-dynamic";

/**
 * GET /api/llm-config
 * Retrieve the current LLM configuration
 */
export async function GET() {
    try {
        const config = await getLlmConfig();

        // Don't expose sensitive keys in full
        const sanitizedConfig = {
            ...config,
            azure: config.azure
                ? {
                    ...config.azure,
                    apiKey: config.azure.apiKey ? "••••••••" : "",
                }
                : undefined,
            lmstudio: config.lmstudio
                ? {
                    ...config.lmstudio,
                    apiKey: config.lmstudio.apiKey ? "••••••••" : "",
                }
                : undefined,
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
 * DELETE /api/llm-config
 * Reset configuration to environment variables
 */
export async function DELETE() {
    try {
        const config = await resetToEnvConfig();
        return NextResponse.json(config, { status: 200 });
    } catch (error) {
        console.error("Error resetting LLM config:", error);
        return NextResponse.json(
            { error: "Failed to reset LLM configuration" },
            { status: 500 }
        );
    }
}
