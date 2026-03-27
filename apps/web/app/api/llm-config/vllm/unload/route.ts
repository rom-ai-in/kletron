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
 * POST /api/llm-config/vllm/unload
 * Stop / unload the currently running model in vLLM.
 *
 * Tries common vLLM UI endpoints:
 *   POST {base}/stop-vllm
 *   POST {base}/api/stop-vllm
 *   POST {base}/api/stop
 *   POST {base}/api/unload
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
    let lastUrl = "";

    try {
        const llmConfig = await getLlmConfig().catch(() => null);
        const rawBaseUrl = llmConfig?.vllm?.baseUrl ?? envConfig.vllm.baseUrl ?? "http://127.0.0.1:8001";
        const base = cleanBase(rawBaseUrl);

        const endpoints = [
            `${base}/stop-vllm`,
            `${base}/api/stop-vllm`,
            `${base}/api/stop`,
            `${base}/api/unload`,
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
                    body: JSON.stringify({}),
                    signal: AbortSignal.timeout(timeoutMs),
                });

                if (response.ok) {
                    responseData = await response.json().catch(() => ({}));
                    success = true;
                    break;
                }

                if (response.status === 404 || response.status === 405) {
                    continue;
                }

                const errorText = await response.text();
                lastError = `${response.status}: ${errorText || response.statusText}`;
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                if (errMsg.includes("timeout") || errMsg.includes("aborted")) {
                    return NextResponse.json(
                        {
                            error: `Stop request timed out after ${timeoutMs / 1000}s. Check the vLLM UI directly.`,
                            success: false,
                            details: { endpoint: url, timeoutMs },
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
                message: "vLLM model stopped successfully",
                data: responseData,
            }, { status: 200 });
        }

        return NextResponse.json(
            {
                error: lastError || "No compatible vLLM management API found. Stop the model from the vLLM UI directly.",
                success: false,
                details: { triedEndpoints: endpoints },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error stopping vLLM model:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
                success: false,
                details: {
                    name: error instanceof Error ? error.name : undefined,
                    code: (error as { code?: string }).code,
                    endpoint: lastUrl,
                    timeoutMs,
                },
            },
            { status: 200 }
        );
    }
}
