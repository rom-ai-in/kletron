import { NextResponse } from "next/server";
import { getDb } from "@numezis/server/lib/db";
import { type DriftJobDoc } from "@numezis/server/services/driftAnalysisWorker";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { DEFAULT_DRIFT_STAGES } from "@numezis/shared/driftStages";
import { getEnabledProviders, getLlmConfig } from "@numezis/server/services/llmConfigService";
import { LLM_PROVIDERS, type LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function POST(req: Request) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await req.json();
        const { llmSelection, systemPrompt } = body;

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, body as any);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        if (llmSelection?.provider) {
            const provider = llmSelection.provider as LlmProviderType;
            if (!LLM_PROVIDERS.includes(provider)) {
                return NextResponse.json(
                    { error: `Invalid provider. Must be one of: ${LLM_PROVIDERS.join(", ")}` },
                    { status: 400 }
                );
            }

            const [enabledProviders, config] = await Promise.all([
                getEnabledProviders(),
                getLlmConfig(),
            ]);

            if (!enabledProviders.includes(provider)) {
                return NextResponse.json(
                    { error: `Provider ${provider} is not enabled.` },
                    { status: 400 }
                );
            }

            const providerConfig = (config as any)?.[provider];
            const hasConfig = Boolean(
                providerConfig &&
                (providerConfig.model || providerConfig.baseUrl || providerConfig.endpoint || providerConfig.deployment)
            );
            if (!hasConfig) {
                return NextResponse.json(
                    { error: `Provider ${provider} is not configured.` },
                    { status: 400 }
                );
            }
        }

        const db = await getDb();
        const jobs = db.collection<DriftJobDoc>("drift_analysis_jobs");

        const normalizedSystemPrompt = typeof systemPrompt === "string" ? systemPrompt.trim() : "";
        const totalStages = DEFAULT_DRIFT_STAGES.length;

        const job: any = {
            status: "queued",
            createdAt: new Date(),
            attempts: 0,
            totalStages,
            processedStages: 0,
            currentStageIndex: 0,
            results: [],
            workspaceId: workspace._id,
            llmSelection,
            systemPrompt: normalizedSystemPrompt.length > 0 ? normalizedSystemPrompt : undefined,
        };

        const res = await jobs.insertOne(job as any);

        return NextResponse.json({ jobId: res.insertedId.toString() });
    } catch (error) {
        console.error("Failed to start drift job:", error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
