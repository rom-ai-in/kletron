import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig } from "@/src/services/llmConfigService";
import { config as envConfig } from "@/src/config";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/llm-config/lmstudio/load
 * Load a model in LM Studio
 */
export async function POST(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();
        const modelId = body.model;

        if (!modelId || typeof modelId !== "string") {
            return NextResponse.json(
                { error: "Model ID is required" },
                { status: 400 }
            );
        }

        // Get the configured LM Studio base URL
        const llmConfig = await getLlmConfig().catch(() => null);
        const baseUrl = llmConfig?.lmstudio?.baseUrl ?? envConfig.lmstudio.baseUrl ?? "http://127.0.0.1:1234/v1";

        // Clean baseUrl and construct load endpoint
        // LM Studio uses /api/v1/models/load for the native API
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
        const loadUrl = `${cleanBaseUrl}/api/v1/models/load`;

        // Load the model in LM Studio
        const response = await fetch(loadUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: modelId }),
            signal: AbortSignal.timeout(120000), // 2 minute timeout for loading
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Failed to load model: ${errorText || response.statusText}`, success: false },
                { status: 200 }
            );
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            message: `Model "${modelId}" loaded successfully`,
            data
        }, { status: 200 });
    } catch (error) {
        console.error("Error loading LM Studio model:", error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("aborted");

        return NextResponse.json(
            {
                error: isTimeout
                    ? "Loading timed out. Large models may take longer - check LM Studio directly."
                    : errorMessage,
                success: false
            },
            { status: 200 }
        );
    }
}
