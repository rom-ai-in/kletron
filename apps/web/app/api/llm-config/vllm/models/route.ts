import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig } from "@numezis/server/services/llmConfigService";
import { config as envConfig } from "@numezis/server/config";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

interface OpenAIModel {
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
    root?: string;
    parent?: string;
    max_model_len?: number;
}

interface OpenAIModelsResponse {
    object?: string;
    data?: OpenAIModel[];
}

/**
 * Normalize base URL: strip trailing slashes and /v1 suffix.
 * Input:  "http://127.0.0.1:8001"  or "http://127.0.0.1:8001/v1"  or "http://127.0.0.1:8001/v1/"
 * Output: "http://127.0.0.1:8001"
 */
function cleanBase(url: string): string {
    return url.replace(/\/+$/, "").replace(/\/v1$/, "");
}

/**
 * GET /api/llm-config/vllm/models
 * Fetch available models from vLLM.
 *
 * URL convention:
 *   Management API  → {cleanBase}/api/status, {cleanBase}/api/gpu
 *   OpenAI-compat   → {cleanBase}/v1/models
 */
export async function GET(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
    }

    try {
        const llmConfig = await getLlmConfig().catch(() => null);
        const rawBaseUrl = llmConfig?.vllm?.baseUrl ?? envConfig.vllm.baseUrl ?? "http://127.0.0.1:8001";
        const apiKey = llmConfig?.vllm?.apiKey ?? envConfig.vllm.apiKey;
        const base = cleanBase(rawBaseUrl);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
        }

        let models: Array<{
            id: string;
            name: string;
            loaded: boolean;
            maxContextLength?: number;
            owned_by?: string;
        }> = [];
        let loadedModelId: string | null = null;
        let serverStatus: "running" | "stopped" | "unknown" = "unknown";
        let gpuInfo: Record<string, unknown> | null = null;

        // ── 1. Health check via /api/status ──────────────────────────────
        try {
            const statusResponse = await fetch(`${base}/api/status`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                signal: AbortSignal.timeout(5000),
            });

            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.status === "running" || statusData.running === true) {
                    serverStatus = "running";
                } else if (statusData.status === "stopped" || statusData.running === false) {
                    serverStatus = "stopped";
                }
                // Extract current model from status if available
                if (statusData.model) {
                    loadedModelId = statusData.model;
                }
            }
        } catch {
            // /api/status not available – we'll infer status from /v1/models below
        }

        // ── 2. OpenAI-compatible /v1/models ──────────────────────────────
        try {
            const modelsResponse = await fetch(`${base}/v1/models`, {
                method: "GET",
                headers,
                cache: "no-store",
                signal: AbortSignal.timeout(5000),
            });

            if (modelsResponse.ok) {
                const modelsData: OpenAIModelsResponse = await modelsResponse.json();
                if (serverStatus === "unknown") serverStatus = "running";

                if (modelsData.data && modelsData.data.length > 0) {
                    models = modelsData.data.map((m) => ({
                        id: m.id,
                        name: m.id.split("/").pop() || m.id,
                        loaded: true,
                        maxContextLength: m.max_model_len,
                        owned_by: m.owned_by,
                    }));

                    if (!loadedModelId) {
                        loadedModelId = models[0]?.id ?? null;
                    }
                }
            } else if (serverStatus === "unknown") {
                serverStatus = "stopped";
            }
        } catch {
            if (serverStatus === "unknown") serverStatus = "stopped";
        }

        // ── 3. GPU info from /api/gpu ────────────────────────────────────
        try {
            const gpuResponse = await fetch(`${base}/api/gpu`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                signal: AbortSignal.timeout(3000),
            });

            if (gpuResponse.ok) {
                gpuInfo = await gpuResponse.json();
            }
        } catch {
            // GPU info endpoint not available – that's fine
        }

        return NextResponse.json({
            models,
            loadedModel: loadedModelId,
            serverStatus,
            gpuInfo,
        }, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Error fetching vLLM models:", error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isConnectionError = errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("fetch failed") ||
            errorMessage.includes("timeout");

        return NextResponse.json(
            {
                error: isConnectionError
                    ? "Cannot connect to vLLM server. Make sure it is running."
                    : errorMessage,
                models: [],
                loadedModel: null,
                serverStatus: "stopped",
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }
}
