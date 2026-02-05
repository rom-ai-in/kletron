import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

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
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const run = await chainExecutor.getRun(runId, workspace._id.toString());

        if (!run) {
            return NextResponse.json({ error: "Execution run not found" }, { status: 404 });
        }

        // Fetch the associated campaign configuration
        const chain = await chainExecutor.getChain(run.chainId.toString(), workspace._id.toString());

        return NextResponse.json({ run, chain }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/runs/${params.id} GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get execution run" },
            { status: 500 }
        );
    }
}
