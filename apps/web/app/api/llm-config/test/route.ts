import { NextRequest, NextResponse } from "next/server";
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";
import { getLlmConfig } from "@numezis/server/services/llmConfigService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

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
            return NextResponse.json(
                { error: "Provider and configuration are required" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { error: "Cannot use a masked API key for testing. Please re-enter your API key." },
                { status: 400 }
            );
        }

        if (provider === "azure" && !effectiveApiKey) {
            return NextResponse.json(
                { error: "API Key is missing for Azure OpenAI. Please ensure a valid API key is saved in the configuration." },
                { status: 400 }
            );
        }

        let model;

        if (provider === "lmstudio") {
            const { baseUrl, model: modelName } = effectiveConfig;

            if (!modelName) {
                return NextResponse.json(
                    { error: "Model name is required for LM Studio" },
                    { status: 400 }
                );
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
                return NextResponse.json(
                    { error: "Base URL is required for Ollama. Configure it in the UI." },
                    { status: 400 }
                );
            }
            const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

            const startTime = Date.now();

            // First, check if Ollama is reachable
            const tagsResponse = await fetch(`${cleanBaseUrl}/api/tags`, {
                method: "GET",
                signal: AbortSignal.timeout(10000),
            });

            if (!tagsResponse.ok) {
                return NextResponse.json(
                    { error: `Ollama returned ${tagsResponse.status}: ${await tagsResponse.text()}` },
                    { status: 500 }
                );
            }

            const tagsData = await tagsResponse.json();
            const availableModels = tagsData.models?.map((m: { name: string }) => m.name) || [];
            const modelExists = !modelName || availableModels.some(
                (m: string) => m === modelName || m.startsWith(`${modelName}:`)
            );

            if (modelName && !modelExists) {
                return NextResponse.json(
                    {
                        error: `Model "${modelName}" not found. Available: ${availableModels.join(", ") || "none"}`,
                        availableModels
                    },
                    { status: 404 }
                );
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
                return NextResponse.json(
                    { error: "API Key is required for OpenAI" },
                    { status: 400 }
                );
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
                return NextResponse.json(
                    { error: "API Key is required for Claude (Anthropic)" },
                    { status: 400 }
                );
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
                return NextResponse.json({
                    success: false,
                    error: errorData.error?.message || `Claude API returned ${response.status}`,
                    latency: duration,
                }, { status: response.status });
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
                return NextResponse.json(
                    { error: "API Key is required for Gemini" },
                    { status: 400 }
                );
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
                return NextResponse.json({
                    success: false,
                    error: errorData.error?.message || `Gemini API returned ${response.status}`,
                    latency: duration,
                }, { status: response.status });
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
                return NextResponse.json(
                    { error: "Endpoint and Deployment are required for Azure OpenAI" },
                    { status: 400 }
                );
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
            return NextResponse.json(
                { error: "Invalid provider" },
                { status: 400 }
            );
        }

        // Perform the test with a prompt that generates more tokens for accurate measurement
        const startTime = Date.now();
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

    } catch (error: any) {
        console.error("LLM Connection Test Failed:", error);

        let errorMessage = error.message || "Failed to connect to LLM provider";
        let status = 500;

        if (error.status === 404 || error.code === '404' || error.code === 'MODEL_NOT_FOUND') {
            status = 404;
            errorMessage = `Resource not found (404). Check if your Deployment Name exists in your Azure OpenAI resource, and if the Endpoint URL is correct.`;
        }

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
                details: error.response?.data || error.error || "No additional details"
            },
            { status }
        );
    }
}
