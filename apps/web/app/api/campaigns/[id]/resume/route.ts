import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

/**
 * POST /api/campaigns/[id]/resume
 * Resume a paused campaign
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
        const workspaceId = workspace?._id?.toString();
        if (!workspace || !workspaceId) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const chain = await chainExecutor.getChain(chainId, workspaceId);

        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (chain.status !== "PAUSED") {
            return NextResponse.json(
                { error: "Campaign is not paused" },
                { status: 400 }
            );
        }

        // Resume chain in background
        runWithWorkspaceContext(workspace, () => {
            chainExecutor.resumeChain(chainId, workspaceId).catch((error) => {
                console.error(`[ChainResume] Chain ${chainId} failed:`, error);
            });
        });

        return NextResponse.json({ status: "RUNNING" }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/campaigns/${params.id}/resume POST] Error:`, error);
        return NextResponse.json(
            { error: "Failed to resume campaign" },
            { status: 500 }
        );
    }
}
