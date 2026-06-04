import { NextRequest, NextResponse } from "next/server";
import { updateVertexAIConfig } from "@kletron/server/services/llmConfigService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/llm-config/vertex
 * Update Google Vertex AI configuration. `credentialsJson` is the only secret —
 * leave it empty when running on Cloud Run / GCE / GKE with an attached service
 * account so Application Default Credentials are used.
 */
export async function PUT(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const config = await updateVertexAIConfig(body);

        const sanitizedConfig = {
            ...config,
            vertex: config.vertex
                ? {
                      ...config.vertex,
                      credentialsJson: config.vertex.credentialsJson ? "••••••••" : "",
                  }
                : undefined,
        };

        return NextResponse.json({ config: sanitizedConfig }, { status: 200 });
    } catch (error) {
        console.error("Error updating Vertex AI config:", error);
        const message = error instanceof Error ? error.message : "Failed to update Vertex AI configuration";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
