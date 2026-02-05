import { NextResponse } from "next/server";

/**
 * POST /api/llm-config/ollama/test
 * Tests Ollama connection by fetching available models
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { baseUrl, model } = body;

        if (!baseUrl) {
            return NextResponse.json(
                { success: false, error: "Base URL is required" },
                { status: 400 }
            );
        }

        // Ensure URL doesn't have trailing slash
        const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

        const results: {
            success: boolean;
            connectionStatus: "connected" | "failed";
            error?: string;
            details: {
                baseUrl: string;
                requestedModel: string;
                availableModels: string[];
                modelFound: boolean;
                responseTime: number;
                ollamaVersion?: string;
            };
        } = {
            success: false,
            connectionStatus: "failed",
            details: {
                baseUrl: cleanBaseUrl,
                requestedModel: model || "",
                availableModels: [],
                modelFound: false,
                responseTime: 0,
            },
        };

        const startTime = Date.now();

        // Step 1: Test basic connectivity by fetching models list
        try {
            const tagsResponse = await fetch(`${cleanBaseUrl}/api/tags`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(10000), // 10s timeout
            });

            results.details.responseTime = Date.now() - startTime;

            if (!tagsResponse.ok) {
                const errorText = await tagsResponse.text();
                results.error = `Ollama returned ${tagsResponse.status}: ${errorText || tagsResponse.statusText}`;
                return NextResponse.json(results, { status: 200 });
            }

            const tagsData = await tagsResponse.json();

            // Extract model names
            if (tagsData.models && Array.isArray(tagsData.models)) {
                results.details.availableModels = tagsData.models.map(
                    (m: { name: string; model?: string }) => m.name || m.model
                ).filter(Boolean);
            }

            results.connectionStatus = "connected";

            // Step 2: Check if requested model exists
            if (model) {
                const modelExists = results.details.availableModels.some(
                    (m) => m === model || m.startsWith(`${model}:`)
                );
                results.details.modelFound = modelExists;

                if (!modelExists) {
                    results.success = false;
                    results.error = `Model "${model}" not found. Available models: ${results.details.availableModels.join(", ") || "none"}`;
                    return NextResponse.json(results, { status: 200 });
                }
            }

            // Step 3: Try to get Ollama version
            try {
                const versionResponse = await fetch(`${cleanBaseUrl}/api/version`, {
                    method: "GET",
                    signal: AbortSignal.timeout(5000),
                });
                if (versionResponse.ok) {
                    const versionData = await versionResponse.json();
                    results.details.ollamaVersion = versionData.version;
                }
            } catch {
                // Version endpoint is optional, ignore errors
            }

            results.success = true;
            results.error = undefined;

            return NextResponse.json(results, { status: 200 });

        } catch (fetchError) {
            results.details.responseTime = Date.now() - startTime;

            if (fetchError instanceof Error) {
                if (fetchError.name === "TimeoutError" || fetchError.name === "AbortError") {
                    results.error = `Connection timed out after 10s. Is Ollama running at ${cleanBaseUrl}?`;
                } else if (fetchError.message.includes("ECONNREFUSED")) {
                    results.error = `Connection refused. Ollama is not running at ${cleanBaseUrl}. Start it with 'ollama serve'.`;
                } else if (fetchError.message.includes("ENOTFOUND")) {
                    results.error = `Host not found: ${cleanBaseUrl}. Check the URL is correct.`;
                } else {
                    results.error = `Connection failed: ${fetchError.message}`;
                }
            } else {
                results.error = "Unknown connection error";
            }

            return NextResponse.json(results, { status: 200 });
        }

    } catch (error) {
        console.error("[ollama/test] Error:", error);
        return NextResponse.json(
            {
                success: false,
                connectionStatus: "failed",
                error: error instanceof Error ? error.message : "Failed to test connection",
                details: {
                    baseUrl: "",
                    requestedModel: "",
                    availableModels: [],
                    modelFound: false,
                    responseTime: 0,
                },
            },
            { status: 200 }
        );
    }
}
