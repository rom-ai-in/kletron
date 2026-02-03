import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

/**
 * GET /api/campaigns/[id]/report
 * Get aggregated report for a completed chain
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

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Chain not found" }, { status: 404 });
        }

        if (chain.status !== "COMPLETED" && chain.status !== "FAILED") {
            return NextResponse.json(
                { error: "Chain has not completed yet" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                report: chain.finalReport || "",
                findings: chain.aggregatedFindings,
                insights: chain.crossStageInsights,
                metadata: chain.metadata,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(`[API /api/campaigns/${params.id}/report GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get report" },
            { status: 500 }
        );
    }
}
