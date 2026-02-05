import { NextRequest, NextResponse } from "next/server";
import { getEmbeddingConfig } from "@numezis/server/services/embeddingConfigService";
import { EMBEDDING_PROVIDERS, EmbeddingProviderType } from "@numezis/shared/schemas/embeddingConfig.schema";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { provider, config: testConfig } = body;

        if (!EMBEDDING_PROVIDERS.includes(provider as EmbeddingProviderType)) {
            return NextResponse.json(
                { error: `Invalid provider. Must be one of: ${EMBEDDING_PROVIDERS.join(", ")}` },
                { status: 400 }
            );
        }

        const currentConfig = await getEmbeddingConfig();
        const startTime = Date.now();

        // Azure OpenAI
        if (provider === "azure") {
            const azureConfig = testConfig ?? currentConfig.azure;
            if (!azureConfig?.endpoint || !azureConfig?.apiKey || !azureConfig?.deployment) {
                return NextResponse.json(
                    { error: "Azure embedding configuration is incomplete" },
                    { status: 400 }
                );
            }

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

            return handleEmbeddingResponse(response, startTime);
        }

        // OpenAI
        if (provider === "openai") {
            const openaiConfig = testConfig ?? currentConfig.openai;
            if (!openaiConfig?.apiKey) {
                return NextResponse.json(
                    { error: "OpenAI API key is required" },
                    { status: 400 }
                );
            }

            const response = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openaiConfig.apiKey}`,
                    ...(openaiConfig.organization ? { "OpenAI-Organization": openaiConfig.organization } : {}),
                },
                body: JSON.stringify({
                    input: "test embedding",
                    model: openaiConfig.model ?? "text-embedding-3-small",
                }),
            });

            return handleEmbeddingResponse(response, startTime);
        }

        // Voyage AI
        if (provider === "voyage") {
            const voyageConfig = testConfig ?? currentConfig.voyage;
            if (!voyageConfig?.apiKey) {
                return NextResponse.json(
                    { error: "Voyage API key is required" },
                    { status: 400 }
                );
            }

            const response = await fetch("https://api.voyageai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${voyageConfig.apiKey}`,
                },
                body: JSON.stringify({
                    input: ["test embedding"],
                    model: voyageConfig.model ?? "voyage-3",
                }),
            });

            return handleEmbeddingResponse(response, startTime);
        }

        // Google Gemini
        if (provider === "gemini") {
            const geminiConfig = testConfig ?? currentConfig.gemini;
            if (!geminiConfig?.apiKey) {
                return NextResponse.json(
                    { error: "Gemini API key is required" },
                    { status: 400 }
                );
            }

            const model = geminiConfig.model ?? "text-embedding-004";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${geminiConfig.apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: `models/${model}`,
                    content: { parts: [{ text: "test embedding" }] },
                }),
            });

            const latency = Date.now() - startTime;
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return NextResponse.json(
                    { error: errorData.error?.message ?? `Gemini API error: ${response.status}` },
                    { status: response.status }
                );
            }

            const data = await response.json();
            const dimensions = data.embedding?.values?.length ?? 0;
            return NextResponse.json({
                success: true,
                latency,
                dimensions,
                message: `Embedding generated (${dimensions} dimensions)`
            });
        }

        // LM Studio
        if (provider === "lmstudio") {
            const lmConfig = testConfig ?? currentConfig.lmstudio;
            if (!lmConfig?.baseUrl || !lmConfig?.model) {
                return NextResponse.json(
                    { error: "LM Studio embedding configuration is incomplete" },
                    { status: 400 }
                );
            }

            const url = `${lmConfig.baseUrl}/embeddings`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(lmConfig.apiKey ? { "Authorization": `Bearer ${lmConfig.apiKey}` } : {}),
                },
                body: JSON.stringify({
                    input: ["test embedding"],
                    model: lmConfig.model,
                }),
            });

            return handleEmbeddingResponse(response, startTime);
        }

        // Ollama
        if (provider === "ollama") {
            const ollamaConfig = testConfig ?? currentConfig.ollama;
            if (!ollamaConfig?.baseUrl || !ollamaConfig?.model) {
                return NextResponse.json(
                    { error: "Ollama embedding configuration is incomplete" },
                    { status: 400 }
                );
            }

            const url = `${ollamaConfig.baseUrl}/api/embeddings`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: ollamaConfig.model,
                    prompt: "test embedding",
                }),
            });

            const latency = Date.now() - startTime;
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return NextResponse.json(
                    { error: errorData.error ?? `Ollama API error: ${response.status}` },
                    { status: response.status }
                );
            }

            const data = await response.json();
            const dimensions = data.embedding?.length ?? 0;
            return NextResponse.json({
                success: true,
                latency,
                dimensions,
                message: `Embedding generated (${dimensions} dimensions)`
            });
        }

        return NextResponse.json({ error: "Unknown provider" }, { status: 400 });

    } catch (error) {
        console.error("Embedding test failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Connection test failed" },
            { status: 500 }
        );
    }
}

async function handleEmbeddingResponse(response: Response, startTime: number) {
    const latency = Date.now() - startTime;

    if (!response.ok) {
        const raw = await response.text().catch(() => "");
        let errorData: any = {};
        try {
            errorData = raw ? JSON.parse(raw) : {};
        } catch {
            // ignore parse errors and fall back to raw
        }
        const errorMessage =
            errorData?.error?.message ??
            errorData?.message ??
            errorData?.error ??
            (raw ? raw : `API error: ${response.status}`);
        return NextResponse.json(
            { error: errorMessage },
            { status: response.status }
        );
    }

    const data = await response.json();
    const embedding =
        data?.data?.[0]?.embedding ??
        data?.embedding ??
        data?.data?.embedding ??
        null;
    const dimensions = Array.isArray(embedding) ? embedding.length : 0;

    return NextResponse.json({
        success: true,
        latency,
        dimensions,
        message: `Embedding generated (${dimensions} dimensions)`
    });
}
