import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

/**
 * GET /api/runs/[id]
 * Get detailed information about a specific execution run
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
        const runId = params.id;
        const run = await chainExecutor.getRun(runId);

        if (!run) {
            return NextResponse.json({ error: "Execution run not found" }, { status: 404 });
        }

        // Fetch the associated campaign configuration
        const chain = await chainExecutor.getChain(run.chainId.toString());

        return NextResponse.json({ run, chain }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/runs/${params.id} GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get execution run" },
            { status: 500 }
        );
    }
}
