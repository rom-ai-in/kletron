import { NextRequest, NextResponse } from "next/server";
import { getEmbeddingConfig } from "@/src/services/embeddingConfigService";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { provider, config: testConfig } = body;

        // Get current config if not provided
        const currentConfig = await getEmbeddingConfig();

        const startTime = Date.now();

        if (provider === "azure") {
            const azureConfig = testConfig ?? currentConfig.azure;
            if (!azureConfig?.endpoint || !azureConfig?.apiKey || !azureConfig?.deployment) {
                return NextResponse.json(
                    { error: "Azure embedding configuration is incomplete" },
                    { status: 400 }
                );
            }

            // Test Azure OpenAI embedding endpoint
            const url = `${azureConfig.endpoint}/openai/deployments/${azureConfig.deployment}/embeddings?api-version=${azureConfig.apiVersion ?? "2024-02-01"}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": azureConfig.apiKey,
                },
                body: JSON.stringify({
                    input: "test embedding",
                    model: azureConfig.model ?? "text-embedding-ada-002",
                }),
            });

            const latency = Date.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return NextResponse.json(
                    { error: errorData.error?.message ?? `Azure API error: ${response.status}` },
                    { status: response.status }
                );
            }

            const data = await response.json();
            const dimensions = data.data?.[0]?.embedding?.length ?? 0;

            return NextResponse.json({
                success: true,
                latency,
                dimensions,
                message: `Embedding generated (${dimensions} dimensions)`
            });
        } else if (provider === "lmstudio") {
            const lmConfig = testConfig ?? currentConfig.lmstudio;
            if (!lmConfig?.baseUrl || !lmConfig?.model) {
                return NextResponse.json(
                    { error: "LM Studio embedding configuration is incomplete" },
                    { status: 400 }
                );
            }

            // Test LM Studio embedding endpoint (OpenAI-compatible)
            const url = `${lmConfig.baseUrl}/embeddings`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(lmConfig.apiKey ? { "Authorization": `Bearer ${lmConfig.apiKey}` } : {}),
                },
                body: JSON.stringify({
                    input: "test embedding",
                    model: lmConfig.model,
                }),
            });

            const latency = Date.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return NextResponse.json(
                    { error: errorData.error?.message ?? `LM Studio API error: ${response.status}` },
                    { status: response.status }
                );
            }

            const data = await response.json();
            const dimensions = data.data?.[0]?.embedding?.length ?? 0;

            return NextResponse.json({
                success: true,
                latency,
                dimensions,
                message: `Embedding generated (${dimensions} dimensions)`
            });
        } else {
            return NextResponse.json(
                { error: "Invalid provider. Must be 'azure' or 'lmstudio'" },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error("Embedding test failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Connection test failed" },
            { status: 500 }
        );
    }
}
