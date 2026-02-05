import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

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

        const chain = await chainExecutor.getChain(chainId);

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
        chainExecutor.resumeChain(chainId).catch((error) => {
            console.error(`[ChainResume] Chain ${chainId} failed:`, error);
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
