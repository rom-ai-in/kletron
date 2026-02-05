import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * POST /api/campaigns/[id]/pause
 * Pause a running campaign
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

    try {
        const chainId = params.id;

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const chain = await chainExecutor.getChain(chainId, workspace._id.toString());

        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (chain.status !== "RUNNING") {
            return NextResponse.json(
                { error: "Campaign is not running" },
                { status: 400 }
            );
        }

        await chainExecutor.pauseChain(chainId, workspace._id.toString());

        return NextResponse.json({ status: "PAUSED" }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/campaigns/${params.id}/pause POST] Error:`, error);
        return NextResponse.json(
            { error: "Failed to pause campaign" },
            { status: 500 }
        );
    }
}
