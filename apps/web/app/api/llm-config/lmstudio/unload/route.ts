import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig } from "@kletron/server/services/llmConfigService";
import { config as envConfig } from "@kletron/server/config";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

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

    const timeoutMs = 30000;
    let unloadUrl = "";
    let instanceId: string | undefined;

    try {
        const body = await request.json();
        instanceId = body.instanceId;

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
        unloadUrl = `${cleanBaseUrl}/api/v1/models/unload`;

        // Unload the model from LM Studio using instance_id
        const response = await fetch(unloadUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ instance_id: instanceId }),
            signal: AbortSignal.timeout(timeoutMs), // 30 second timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                {
                    error: `Failed to unload model: ${errorText || response.statusText}`,
                    success: false,
                    details: {
                        status: response.status,
                        statusText: response.statusText,
                        endpoint: unloadUrl,
                        instanceId,
                    },
                },
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
        const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("aborted");

        return NextResponse.json(
            {
                error: isTimeout
                    ? `Unloading timed out after ${timeoutMs / 1000}s. Check LM Studio directly.`
                    : errorMessage,
                success: false,
                details: {
                    name: error instanceof Error ? error.name : undefined,
                    code: (error as { code?: string }).code,
                    endpoint: unloadUrl,
                    timeoutMs,
                    instanceId,
                },
            },
            { status: 200 }
        );
    }
}
