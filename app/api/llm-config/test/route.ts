import { NextRequest, NextResponse } from "next/server";
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";
import { getLlmConfig } from "@/src/services/llmConfigService";

export const dynamic = "force-dynamic";

/**
 * POST /api/llm-config/test
 * Test the LLM configuration connectivity
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { provider, config } = body;

        if (!provider || !config) {
            return NextResponse.json(
                { error: "Provider and configuration are required" },
                { status: 400 }
            );
        }

        // Fallback to stored API key if missing or masked
        let effectiveApiKey = config.apiKey;
        if (!effectiveApiKey || effectiveApiKey === "••••••••") {
            const storedConfig = await getLlmConfig();
            if (provider === "azure" && storedConfig.azure?.apiKey) {
                effectiveApiKey = storedConfig.azure.apiKey;
            } else if (provider === "lmstudio" && storedConfig.lmstudio?.apiKey) {
                effectiveApiKey = storedConfig.lmstudio.apiKey;
            }
        }

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
            const { baseUrl, model: modelName } = config;

            if (!modelName) {
                return NextResponse.json(
                    { error: "Model name is required for LM Studio" },
                    { status: 400 }
                );
            }

            model = new ChatOpenAI({
                model: modelName,
                apiKey: effectiveApiKey || "lm-studio",
                configuration: {
                    baseURL: baseUrl,
                },
            });
        } else if (provider === "azure") {
            const { endpoint, deployment, apiVersion, model: modelName } = config;

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

        // Perform the test
        const startTime = Date.now();
        const response = await model.invoke("Hello");
        const duration = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            latency: duration,
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
