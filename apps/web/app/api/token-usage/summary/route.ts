export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { tokenUsageService } from "@numezis/server/services/tokenUsageService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/token-usage/summary
 * Get aggregated token usage with optional filters
 * 
 * Query params:
 * - from: ISO date string for start date filter
 * - to: ISO date string for end date filter
 * - runId: Filter by specific run
 * - automationId: Filter by specific automation
 * - provider: Filter by LLM provider
 * - model: Filter by model name
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const filter = {
            from: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
            to: searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined,
            runId: searchParams.get("runId") ?? undefined,
            chainId: searchParams.get("automationId") ?? undefined,
            workspaceId: workspace._id.toString(),
            provider: searchParams.get("provider") as any ?? undefined,
            model: searchParams.get("model") ?? undefined,
        };

        const usage = await tokenUsageService.getUsageSummary(filter);
        return NextResponse.json({ usage }, { status: 200 });
    } catch (error) {
        console.error("[API /api/token-usage/summary] Error:", error);
        return NextResponse.json({ error: "Failed to get token usage summary" }, { status: 500 });
    }
}
