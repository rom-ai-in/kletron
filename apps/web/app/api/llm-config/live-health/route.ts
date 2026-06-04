import { NextRequest, NextResponse } from "next/server";
import { getLlmConfig } from "@kletron/server/services/llmConfigService";
import { probeLlmLiveHealth } from "@kletron/server/services/llmLiveHealthProbe";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { LLM_PROVIDERS, type LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";

export const dynamic = "force-dynamic";

type LiveHealthBody = { provider?: string };

/**
 * POST /api/llm-config/live-health
 * Server-side reachability probe for the status indicator (no completion call).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            });
        }

        const body = (await req.json().catch(() => ({}))) as LiveHealthBody;
        const provider = body.provider as LlmProviderType | undefined;
        if (!provider || !LLM_PROVIDERS.includes(provider)) {
            return NextResponse.json(
                { status: "error" as const, message: "Invalid or missing provider" },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        const fullConfig = await getLlmConfig();
        const slice =
            ((fullConfig as Record<string, unknown>)[provider] as Record<string, unknown> | undefined) ??
            (provider === "codex"
                ? ((fullConfig as Record<string, unknown>).openai as Record<string, unknown> | undefined)
                : undefined);

        if (!slice) {
            return NextResponse.json(
                { status: "none" as const, message: "No configuration found" },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        const hasConfiguredFlag = typeof slice.configured === "boolean";
        if (hasConfiguredFlag && slice.configured === false) {
            return NextResponse.json(
                { status: "none" as const, message: "Not configured" },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        const hasApiKey = !!slice.apiKey;
        const hasBaseUrl = !!slice.baseUrl;
        const hasEndpoint = !!slice.endpoint;
        const hasProjectId = !!slice.projectId;
        const hasLocation = !!slice.location;

        const needsKey = ["azure", "openai", "claude", "gemini"].includes(provider);
        const needsUrl = ["codex", "lmstudio", "ollama", "vllm"].includes(provider);
        const needsGcpProject = ["vertex"].includes(provider);

        if (needsKey && !hasApiKey) {
            return NextResponse.json(
                { status: "error" as const, message: "API key not configured" },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (needsUrl && !hasBaseUrl && !hasEndpoint) {
            return NextResponse.json(
                { status: "error" as const, message: "Base URL not configured" },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (needsGcpProject && (!hasProjectId || !hasLocation)) {
            return NextResponse.json(
                { status: "error" as const, message: "Project ID and location are required" },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        const model =
            (typeof slice.model === "string" && slice.model) ||
            (typeof slice.deployment === "string" && slice.deployment) ||
            "";

        const probe = await probeLlmLiveHealth(provider, fullConfig);

        if (probe.ok) {
            const detail = model ? `${probe.message} · ${model}` : probe.message;
            return NextResponse.json(
                { status: "success" as const, message: detail },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            { status: "error" as const, message: probe.message },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("live-health error:", error);
        return NextResponse.json(
            {
                status: "error" as const,
                message: error instanceof Error ? error.message : "Health check failed",
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }
}
