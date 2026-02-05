import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

/**
 * POST /api/campaigns/[id]/cancel
 * Cancel the latest execution run for a campaign (best-effort: takes effect between stages)
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

    const latestRun = await chainExecutor.getLatestRun(chainId);
    if (!latestRun) {
      return NextResponse.json({ error: "No run found to cancel" }, { status: 404 });
    }

    if (latestRun.status === "COMPLETED" || latestRun.status === "FAILED" || latestRun.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Latest run is not cancellable (status: ${latestRun.status})` },
        { status: 400 }
      );
    }

    await chainExecutor.cancelRun(latestRun._id!.toString());
    return NextResponse.json({ status: "CANCELLED", runId: latestRun._id!.toString() }, { status: 200 });
  } catch (error) {
    console.error(`[API /api/campaigns/${params.id}/cancel POST] Error:`, error);
    return NextResponse.json({ error: "Failed to cancel campaign run" }, { status: 500 });
  }
}

