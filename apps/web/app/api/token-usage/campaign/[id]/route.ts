export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { tokenUsageService } from "@numezis/server/services/tokenUsageService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { chainExecutor } from "@numezis/server/services/chainExecutor";

/**
 * GET /api/token-usage/campaign/[id]
 * Get token usage for a specific campaign
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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

        const chain = await chainExecutor.getChain(params.id, workspace._id.toString());
        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        const usage = await tokenUsageService.getCampaignUsage(params.id, workspace._id.toString());
        return NextResponse.json({ usage }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/token-usage/campaign/${params.id}] Error:`, error);
        return NextResponse.json({ error: "Failed to get campaign token usage" }, { status: 500 });
    }
}
