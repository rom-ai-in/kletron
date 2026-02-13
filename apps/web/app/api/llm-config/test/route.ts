import { NextRequest, NextResponse } from "next/server";
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";
import { getLlmConfig } from "@numezis/server/services/llmConfigService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

const okError = (error: string, extra?: Record<string, unknown>) =>
    NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status: 200 });

/**
 * POST /api/llm-config/test
 * Test the LLM configuration connectivity
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ "error": "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const { provider, config } = body;

        if (!provider || !config) {
            return okError("Provider and configuration are required");
        }

        // Fallback to stored API key/config if missing or masked
        const storedConfig = await getLlmConfig();
        const storedProviderConfig = (storedConfig as any)?.[provider] ?? {};

        let effectiveApiKey = config.apiKey;
        if (!effectiveApiKey || effectiveApiKey === "••••••••") {
            effectiveApiKey = storedProviderConfig.apiKey;
        }

        const effectiveConfig = {
            ...storedProviderConfig,
            ...config,
            apiKey: effectiveApiKey,
        };

        // Check if we still have a masked key after fallback
        if (effectiveApiKey?.includes("•")) {
            return okError("Cannot use a masked API key for testing. Please re-enter your API key.");
        }

        if (provider === "azure" && !effectiveApiKey) {
            return okError("API Key is missing for Azure OpenAI. Please ensure a valid API key is saved in the configuration.");
        }

        let model;

        if (provider === "vllm") {
            const { baseUrl, model: modelName } = effectiveConfig;

            if (!baseUrl) {
                return okError("Base URL is required for vLLM. Configure it in the UI.");
            }

            // Normalize: strip trailing slashes, strip /v1 if present
            const cleanBaseUrl = (baseUrl as string).replace(/\/+$/, "").replace(/\/v1$/, "");

            // 1. Health check: try /api/status (vLLM UI backend), fall back to /v1/models (vanilla vLLM)
            const startTime = Date.now();
            let healthOk = false;
            try {
                const statusResponse = await fetch(`${cleanBaseUrl}/api/status`, {
                    method: "GET",
                    signal: AbortSignal.timeout(5000),
                });
                // 200 = vLLM UI backend is present and healthy
                // 404/405 = vanilla vLLM engine (doesn't have /api/status) – fall through
                if (statusResponse.ok) {
                    healthOk = true;
                }
            } catch {
                // Connection error on /api/status – will try /v1/models next
            }

            if (!healthOk) {
                try {
                    const modelsResponse = await fetch(`${cleanBaseUrl}/v1/models`, {
                        method: "GET",
                        signal: AbortSignal.timeout(5000),
                    });
                    if (modelsResponse.ok) {
                        healthOk = true;
                    } else {
                        return okError(`Cannot reach vLLM server at ${cleanBaseUrl}. /v1/models returned ${modelsResponse.status}.`);
                    }
                } catch {
                    return okError(`Cannot connect to vLLM at ${cleanBaseUrl}. Make sure the server is running and accessible.`);
                }
            }

            if (!modelName) {
                // No model specified – just report server is reachable
                const duration = Date.now() - startTime;
                return NextResponse.json({
                    success: true,
                    latency: duration,
                    message: "Connection successful",
                    response: "vLLM server is reachable (no model selected for inference test)",
                }, { status: 200 });
            }

            // 2. Full inference test via OpenAI-compatible API
            const vllmOpenAIBaseUrl = `${cleanBaseUrl}/v1`;

            const modelSettings = modelName && effectiveConfig?.modelSettings?.[modelName]
                ? effectiveConfig.modelSettings[modelName]
                : undefined;

            const modelKwargs: Record<string, unknown> = {};
            if (typeof modelSettings?.topK === "number") {
                modelKwargs.top_k = modelSettings.topK;
            }
            if (typeof modelSettings?.repeatPenalty === "number") {
                modelKwargs.repeat_penalty = modelSettings.repeatPenalty;
            }

            model = new ChatOpenAI({
                model: modelName,
                apiKey: effectiveApiKey || "vllm",
                configuration: {
                    baseURL: vllmOpenAIBaseUrl,
                },
                temperature: typeof modelSettings?.temperature === "number" ? modelSettings.temperature : 1,
                ...(typeof modelSettings?.maxTokens === "number" ? { maxTokens: modelSettings.maxTokens } : {}),
                ...(typeof modelSettings?.topP === "number" ? { topP: modelSettings.topP } : {}),
                ...(typeof modelSettings?.presencePenalty === "number" ? { presencePenalty: modelSettings.presencePenalty } : {}),
                ...(typeof modelSettings?.frequencyPenalty === "number" ? { frequencyPenalty: modelSettings.frequencyPenalty } : {}),
                ...(Object.keys(modelKwargs).length ? { modelKwargs } : {}),
            });
        } else if (provider === "lmstudio") {
            const { baseUrl, model: modelName } = effectiveConfig;

            if (!modelName) {
                return okError("Model name is required for LM Studio");
            }

            const modelSettings = modelName && effectiveConfig?.modelSettings?.[modelName]
                ? effectiveConfig.modelSettings[modelName]
                : undefined;

            const modelKwargs: Record<string, unknown> = {};
            if (typeof modelSettings?.topK === "number") {
                modelKwargs.top_k = modelSettings.topK;
            }
            if (typeof modelSettings?.repeatPenalty === "number") {
                modelKwargs.repeat_penalty = modelSettings.repeatPenalty;
            }

                model = new ChatOpenAI({
                    model: modelName,
                    apiKey: effectiveApiKey || "lm-studio",
                    configuration: {
                        baseURL: baseUrl,
                    },
                temperature: typeof modelSettings?.temperature === "number" ? modelSettings.temperature : 1,
                ...(typeof modelSettings?.maxTokens === "number" ? { maxTokens: modelSettings.maxTokens } : {}),
                ...(typeof modelSettings?.topP === "number" ? { topP: modelSettings.topP } : {}),
                ...(typeof modelSettings?.presencePenalty === "number" ? { presencePenalty: modelSettings.presencePenalty } : {}),
                ...(typeof modelSettings?.frequencyPenalty === "number" ? { frequencyPenalty: modelSettings.frequencyPenalty } : {}),
                ...(Object.keys(modelKwargs).length ? { modelKwargs } : {}),
            });
        } else if (provider === "ollama") {
            // Use Ollama's native API for health check
            const { baseUrl, model: modelName } = effectiveConfig;
            if (!baseUrl) {
                return okError("Base URL is required for Ollama. Configure it in the UI.");
            }
            const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

            const startTime = Date.now();

            // First, check if Ollama is reachable
            const tagsResponse = await fetch(`${cleanBaseUrl}/api/tags`, {
                method: "GET",
                signal: AbortSignal.timeout(10000),
            });

            if (!tagsResponse.ok) {
                return okError(`Ollama returned ${tagsResponse.status}: ${await tagsResponse.text()}`, {
                    status: tagsResponse.status,
                });
            }

            const tagsData = await tagsResponse.json();
            const availableModels = tagsData.models?.map((m: { name: string }) => m.name) || [];
            const modelExists = !modelName || availableModels.some(
                (m: string) => m === modelName || m.startsWith(`${modelName}:`)
            );

            if (modelName && !modelExists) {
                return okError(`Model "${modelName}" not found. Available: ${availableModels.join(", ") || "none"}`, {
                    availableModels,
                });
            }

            const duration = Date.now() - startTime;

            return NextResponse.json({
                success: true,
                latency: duration,
                message: "Connection successful",
                response: `Ollama ready. Models: ${availableModels.length}`,
                availableModels,
            }, { status: 200 });

        } else if (provider === "openai") {
            // Use ChatOpenAI for OpenAI testing
            const { model: modelName } = effectiveConfig;

            if (!effectiveApiKey) {
                return okError("API Key is required for OpenAI");
            }

            model = new ChatOpenAI({
                model: modelName || "gpt-4o",
                apiKey: effectiveApiKey,
                configuration: effectiveConfig.baseUrl ? { baseURL: effectiveConfig.baseUrl } : undefined,
            });

        } else if (provider === "claude") {
            // Use Anthropic API health check
            const { model: modelName } = effectiveConfig;

            if (!effectiveApiKey) {
                return okError("API Key is required for Claude (Anthropic)");
            }

            const startTime = Date.now();

            // Simple health check by calling the messages API with minimal tokens
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": effectiveApiKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: modelName || "claude-sonnet-4-20250514",
                    max_tokens: 50,
                    messages: [{ role: "user", content: "Count from 1 to 10." }],
                }),
                signal: AbortSignal.timeout(30000),
            });

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return okError(errorData.error?.message || `Claude API returned ${response.status}`, {
                    latency: duration,
                    status: response.status,
                });
            }

            const claudeData = await response.json();
            const outputTokens = claudeData.usage?.output_tokens || 0;
            const tokensPerSecond = duration > 0 ? Math.round((outputTokens / (duration / 1000)) * 10) / 10 : 0;

            return NextResponse.json({
                success: true,
                latency: duration,
                tokensPerSecond,
                outputTokens,
                message: "Connection successful",
                response: "Claude API ready",
            }, { status: 200 });

        } else if (provider === "gemini") {
            // Use Google AI health check
            const { model: modelName } = effectiveConfig;

            if (!effectiveApiKey) {
                return okError("API Key is required for Gemini");
            }

            const startTime = Date.now();
            const model_id = modelName || "gemini-2.5-flash";

            // Call Gemini generateContent API with minimal request
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model_id}:generateContent?key=${effectiveApiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "Count from 1 to 10." }] }],
                        generationConfig: { maxOutputTokens: 50 },
                    }),
                    signal: AbortSignal.timeout(30000),
                }
            );

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return okError(errorData.error?.message || `Gemini API returned ${response.status}`, {
                    latency: duration,
                    status: response.status,
                });
            }

            const geminiData = await response.json();
            const outputTokens = geminiData.usageMetadata?.candidatesTokenCount || 0;
            const tokensPerSecond = duration > 0 ? Math.round((outputTokens / (duration / 1000)) * 10) / 10 : 0;

            return NextResponse.json({
                success: true,
                latency: duration,
                tokensPerSecond,
                outputTokens,
                message: "Connection successful",
                response: "Gemini API ready",
            }, { status: 200 });

        } else if (provider === "azure") {
            const { endpoint, deployment, apiVersion, model: modelName } = effectiveConfig;

            if (!endpoint || !deployment) {
                return okError("Endpoint and Deployment are required for Azure OpenAI");
            }

            model = new AzureChatOpenAI({
                azureOpenAIApiKey: effectiveApiKey,
                azureOpenAIApiDeploymentName: deployment,
                azureOpenAIApiVersion: apiVersion,
                azureOpenAIApiInstanceName: new URL(endpoint).hostname.split(".")[0],
                azureOpenAIEndpoint: endpoint,
                model: modelName, // Optional for Azure if deployment suffices, but good to have
            });
        } else {
            return okError("Invalid provider");
        }

        // Perform the test with a prompt that generates more tokens for accurate measurement
        const startTime = Date.now();

        try {
            const response = await model.invoke("Count from 1 to 10.");
            const duration = Date.now() - startTime;

            // Extract token usage from LangChain response metadata
            const outputTokens = response.usage_metadata?.output_tokens || 0;
            const tokensPerSecond = duration > 0 && outputTokens > 0
                ? Math.round((outputTokens / (duration / 1000)) * 10) / 10
                : undefined;

            return NextResponse.json({
                success: true,
                latency: duration,
                ...(tokensPerSecond !== undefined && { tokensPerSecond }),
                ...(outputTokens > 0 && { outputTokens }),
                message: "Connection successful",
                response: response.content ? response.content.toString().slice(0, 50) + "..." : "No content",
            }, { status: 200 });
        } catch (chatError: any) {
            // If /v1/chat/completions returns 405, the model may only support
            // the raw /v1/completions endpoint (no chat template).  Fall back
            // to a plain completions call for vLLM / LM Studio providers.
            const is405 = chatError?.status === 405 ||
                chatError?.message?.includes("405") ||
                chatError?.cause?.status === 405;

            if (is405 && (provider === "vllm" || provider === "lmstudio")) {
                try {
                    const cfg = (model as any)?.clientConfig ?? {};
                    const baseURL = cfg.baseURL ??
                        ((model as any)?.configuration?.baseURL) ??
                        ((model as any)?.client?.baseURL);

                    // Resolve the /v1 base URL for the raw completions call
                    let completionsBaseUrl: string | undefined;
                    if (baseURL) {
                        completionsBaseUrl = baseURL;
                    } else if (provider === "vllm") {
                        const { baseUrl: rawUrl } = body.config;
                        if (rawUrl) {
                            const clean = (rawUrl as string).replace(/\/+$/, "").replace(/\/v1$/, "");
                            completionsBaseUrl = `${clean}/v1`;
                        }
                    }

                    if (!completionsBaseUrl) {
                        throw chatError; // cannot determine URL – rethrow
                    }

                    const completionsUrl = `${completionsBaseUrl.replace(/\/+$/, "")}/completions`;
                    const apiKey = body.config?.apiKey || "vllm";

                    const fbStart = Date.now();
                    const fbRes = await fetch(completionsUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                        },
                        body: JSON.stringify({
                            model: body.config?.model,
                            prompt: "Count from 1 to 10.",
                            max_tokens: 64,
                        }),
                        signal: AbortSignal.timeout(30000),
                    });

                    const fbDuration = Date.now() - fbStart;

                    if (!fbRes.ok) {
                        const errBody = await fbRes.text().catch(() => "");
                        return okError(
                            `${fbRes.status} from /v1/completions${errBody ? `: ${errBody.slice(0, 200)}` : ""}`,
                        );
                    }

                    const fbData = await fbRes.json();
                    const fbText =
                        fbData.choices?.[0]?.text?.trim() ||
                        fbData.choices?.[0]?.message?.content?.trim() ||
                        "No content";
                    const fbTokens = fbData.usage?.completion_tokens || 0;
                    const fbTps = fbDuration > 0 && fbTokens > 0
                        ? Math.round((fbTokens / (fbDuration / 1000)) * 10) / 10
                        : undefined;

                    return NextResponse.json({
                        success: true,
                        latency: fbDuration,
                        ...(fbTps !== undefined && { tokensPerSecond: fbTps }),
                        ...(fbTokens > 0 && { outputTokens: fbTokens }),
                        message: "Connection successful (via /v1/completions – model has no chat template)",
                        response: fbText.slice(0, 50) + (fbText.length > 50 ? "..." : ""),
                    }, { status: 200 });
                } catch (fbErr: any) {
                    // Completions fallback also failed – report original 405 with guidance
                    return okError(
                        "Model does not support /v1/chat/completions (405) and /v1/completions fallback also failed. " +
                        "Make sure the vLLM server URL and port are correct.",
                        { details: fbErr?.message || "No additional details" },
                    );
                }
            }

            // Not a 405 or not vllm/lmstudio – rethrow to the outer catch
            throw chatError;
        }

    } catch (error: any) {
        console.error("LLM Connection Test Failed:", error);

        let errorMessage = error.message || "Failed to connect to LLM provider";
        if (error.status === 404 || error.code === '404' || error.code === 'MODEL_NOT_FOUND') {
            errorMessage = "Resource not found (404). Check if your Deployment Name exists in your Azure OpenAI resource, and if the Endpoint URL is correct.";
        }

        return okError(errorMessage, {
            details: error.response?.data || error.error || "No additional details",
        });
    }
}
