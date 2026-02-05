import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

/**
 * PUT /api/campaigns/[id]/execute
 * Start campaign execution (non-blocking)
 */
export async function PUT(
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

        if (chain.status === "RUNNING") {
            return NextResponse.json(
                { error: "Campaign is already running" },
                { status: 400 }
            );
        }

        const promptIssues = chain.stages
            .map((stage, index) => {
                if (stage.prompt && stage.prompt.trim().length > 0) return null;
                return {
                    index,
                    stageId: stage.id,
                    stageName: stage.name,
                };
            })
            .filter(Boolean);

        if (promptIssues.length > 0) {
            return NextResponse.json(
                {
                    error: "Campaign blocked: one or more stages are missing prompts",
                    details: promptIssues,
                },
                { status: 400 }
            );
        }

        // Create a run immediately so the UI can navigate to it deterministically.
        const runId = await chainExecutor.startNewRun(chainId, workspace._id.toString());

        // Execute run in background (don't await)
        runWithWorkspaceContext(workspace, () => {
            chainExecutor.executeRun(runId).catch((error) => {
                console.error(`[ChainExecution] Run ${runId} (Chain ${chainId}) failed:`, error);
            });
        });

        return NextResponse.json({ status: "STARTED", runId }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/campaigns/${params.id}/execute PUT] Error:`, error);
        return NextResponse.json(
            { error: "Failed to start campaign execution" },
            { status: 500 }
        );
    }
}
