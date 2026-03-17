import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig } from "@kletron/server/services/llmConfigService";
import { config as envConfig } from "@kletron/server/config";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * Normalize base URL: strip trailing slashes and /v1 suffix.
 */
function cleanBase(url: string): string {
    return url.replace(/\/+$/, "").replace(/\/v1$/, "");
}

/**
 * POST /api/llm-config/vllm/load
 * Load a HuggingFace model in vLLM via the management API.
 *
 * Tries common vLLM UI endpoints:
 *   POST {base}/start-vllm       { model: "..." }
 *   POST {base}/api/start-vllm   { model: "..." }
 *   POST {base}/api/load         { model: "..." }
 *   POST {base}/api/load-model   { model: "..." }
 */
export async function POST(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const timeoutMs = 180000; // 3 min – loading HF models can be slow
    let lastUrl = "";
    let modelId: string | undefined;

    try {
        const body = await request.json();
        modelId = body.model;

        if (!modelId || typeof modelId !== "string") {
            return NextResponse.json(
                { error: "Model ID is required (HuggingFace model ID, e.g., nvidia/nemotron-3-nano)" },
                { status: 400 }
            );
        }

        const llmConfig = await getLlmConfig().catch(() => null);
        const rawBaseUrl = llmConfig?.vllm?.baseUrl ?? envConfig.vllm.baseUrl ?? "http://127.0.0.1:8001";
        const base = cleanBase(rawBaseUrl);

        // Endpoints to try, in order of likelihood
        const endpoints = [
            `${base}/start-vllm`,
            `${base}/api/start-vllm`,
            `${base}/api/load`,
            `${base}/api/load-model`,
        ];

        let lastError = "";
        let success = false;
        let responseData: unknown = null;

        for (const url of endpoints) {
            try {
                lastUrl = url;
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model: modelId }),
                    signal: AbortSignal.timeout(timeoutMs),
                });

                if (response.ok) {
                    responseData = await response.json().catch(() => ({}));
                    success = true;
                    break;
                }

                if (response.status === 404 || response.status === 405) {
                    continue; // endpoint doesn't exist – try next
                }

                const errorText = await response.text();
                lastError = `${response.status}: ${errorText || response.statusText}`;
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                if (errMsg.includes("timeout") || errMsg.includes("aborted")) {
                    return NextResponse.json(
                        {
                            error: `Loading timed out after ${timeoutMs / 1000}s. Large models may take longer. Check the vLLM UI directly.`,
                            success: false,
                            details: { endpoint: url, model: modelId, timeoutMs },
                        },
                        { status: 200 }
                    );
                }
                lastError = errMsg;
                continue;
            }
        }

        if (success) {
            return NextResponse.json({
                success: true,
                message: `Model "${modelId}" load request sent successfully`,
                data: responseData,
            }, { status: 200 });
        }

        return NextResponse.json(
            {
                error: lastError || "No compatible vLLM management API found. Load the model directly from the vLLM UI.",
                success: false,
                details: { model: modelId, triedEndpoints: endpoints },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error loading vLLM model:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
                success: false,
                details: {
                    name: error instanceof Error ? error.name : undefined,
                    code: (error as { code?: string }).code,
                    endpoint: lastUrl,
                    timeoutMs,
                    model: modelId,
                },
            },
            { status: 200 }
        );
    }
}
