import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig } from "@numezis/server/services/llmConfigService";
import { config as envConfig } from "@numezis/server/config";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/llm-config/lmstudio/unload
 * Unload a model from LM Studio using instance_id
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
        const instanceId = body.instanceId;

        if (!instanceId || typeof instanceId !== "string") {
            return NextResponse.json(
                { error: "Instance ID is required to unload a model" },
                { status: 400 }
            );
        }

        // Get the configured LM Studio base URL
        const llmConfig = await getLlmConfig().catch(() => null);
        const baseUrl = llmConfig?.lmstudio?.baseUrl ?? envConfig.lmstudio.baseUrl ?? "http://127.0.0.1:1234/v1";

        // Clean baseUrl and construct unload endpoint
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
        const unloadUrl = `${cleanBaseUrl}/api/v1/models/unload`;

        // Unload the model from LM Studio using instance_id
        const response = await fetch(unloadUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ instance_id: instanceId }),
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Failed to unload model: ${errorText || response.statusText}`, success: false },
                { status: 200 }
            );
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            message: "Model unloaded successfully",
            data
        }, { status: 200 });
    } catch (error) {
        console.error("Error unloading LM Studio model:", error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return NextResponse.json(
            {
                error: errorMessage,
                success: false
            },
            { status: 200 }
        );
    }
}
