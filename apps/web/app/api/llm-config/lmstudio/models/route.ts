import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig } from "@numezis/server/services/llmConfigService";
import { config as envConfig } from "@numezis/server/config";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

interface LMStudioLoadedInstance {
    id: string;
    config?: Record<string, unknown>;
}

interface LMStudioV1Model {
    key: string;
    display_name?: string;
    type?: string;
    publisher?: string;
    architecture?: string;
    quantization?: { name: string; bits_per_weight: number };
    size_bytes?: number;
    loaded_instances?: LMStudioLoadedInstance[];
    max_context_length?: number;
}

interface LMStudioV1ModelsResponse {
    models?: LMStudioV1Model[];
}

interface LMStudioV0Model {
    id: string;
    path?: string;
    object?: string;
    type?: string;
    state?: string;
    publisher?: string;
    arch?: string;
    quantization?: string;
}

interface LMStudioV0ModelsResponse {
    data?: LMStudioV0Model[];
    object?: string;
}

/**
 * GET /api/llm-config/lmstudio/models
 * Fetch ALL available models from LM Studio with their loaded status
 * Uses v1 API first (has loaded_instances for unload), falls back to v0
 */
export async function GET(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const llmConfig = await getLlmConfig().catch(() => null);
        const baseUrl = llmConfig?.lmstudio?.baseUrl ?? envConfig.lmstudio.baseUrl ?? "http://127.0.0.1:1234/v1";
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");

        let models: Array<{
            id: string;
            name: string;
            displayName?: string;
            publisher?: string;
            loaded: boolean;
            instanceId?: string;
            architecture?: string;
            quantization?: string;
            size_bytes?: number;
            maxContextLength?: number;
        }> = [];
        let loadedModelId: string | null = null;

        // Try v1 API first - it has loaded_instances with the IDs we need for unload
        try {
            const v1Url = `${cleanBaseUrl}/api/v1/models`;
            const v1Response = await fetch(v1Url, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(5000),
            });

            if (v1Response.ok) {
                const v1Data: LMStudioV1ModelsResponse = await v1Response.json();

                if (v1Data.models && v1Data.models.length > 0) {
                    models = v1Data.models
                        .filter((m) => m.type !== "embeddings" && !m.key.toLowerCase().includes("embed"))
                        .map((m) => {
                            const isLoaded = !!(m.loaded_instances && m.loaded_instances.length > 0);
                            const instanceId = isLoaded ? m.loaded_instances![0].id : undefined;

                            return {
                                id: m.key,
                                name: m.key.split('/').pop() || m.key,
                                displayName: m.display_name,
                                publisher: m.publisher,
                                loaded: isLoaded,
                                instanceId: instanceId,
                                architecture: m.architecture,
                                quantization: m.quantization?.name,
                                size_bytes: m.size_bytes,
                                maxContextLength: m.max_context_length,
                            };
                        });

                    const loadedModel = models.find(m => m.loaded);
                    if (loadedModel) {
                        loadedModelId = loadedModel.id;
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching v1 models:", err);
        }

        // If v1 failed or returned no models, try v0 API
        if (models.length === 0) {
            try {
                const v0Url = `${cleanBaseUrl}/api/v0/models`;
                const v0Response = await fetch(v0Url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    signal: AbortSignal.timeout(5000),
                });

                if (v0Response.ok) {
                    const v0Data: LMStudioV0ModelsResponse = await v0Response.json();

                    models = (v0Data.data || [])
                        .filter((m) => m.type !== "embeddings" && !m.id.toLowerCase().includes("embed"))
                        .map((m) => ({
                            id: m.id,
                            name: m.id.split('/').pop() || m.id,
                            publisher: m.publisher,
                            loaded: m.state === "loaded",
                            instanceId: m.state === "loaded" ? m.id : undefined, // For v0, use id as instanceId
                            architecture: m.arch,
                            quantization: m.quantization,
                            maxContextLength: undefined,
                        }));

                    const loadedModel = models.find(m => m.loaded);
                    if (loadedModel) {
                        loadedModelId = loadedModel.id;
                    }
                }
            } catch (err) {
                console.error("Error fetching v0 models:", err);
            }
        }

        return NextResponse.json({
            models,
            loadedModel: loadedModelId,
        }, { status: 200 });
    } catch (error) {
        console.error("Error fetching LM Studio models:", error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isConnectionError = errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("fetch failed") ||
            errorMessage.includes("timeout");

        return NextResponse.json(
            {
                error: isConnectionError
                    ? "Cannot connect to LM Studio. Make sure it is running."
                    : errorMessage,
                models: [],
                loadedModel: null,
            },
            { status: 200 }
        );
    }
}
