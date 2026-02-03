import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

/**
 * GET /api/campaigns/[id]/runs
 * List all execution runs for a specific campaign
 */
export async function GET(
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
        const runs = await chainExecutor.listRuns(chainId);

        return NextResponse.json({ runs }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/campaigns/${params.id}/runs GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to list campaign runs" },
            { status: 500 }
        );
    }
}
