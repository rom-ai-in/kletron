import { NextRequest } from "next/server";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/campaigns/[id]/stream
 * Server-Sent Events stream for real-time chain execution updates
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

    const chainId = params.id;

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    if (!workspace || !workspace._id) {
        return new Response("Workspace not configured", { status: 400 });
    }
    const workspaceId = workspace._id.toString();

    // Verify chain exists
    const chain = await chainExecutor.getChain(chainId, workspaceId);
    if (!chain) {
        return new Response("Chain not found", { status: 404 });
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Send initial connection event
            const initEvent = `data: ${JSON.stringify({ type: "connected", chainId })}\n\n`;
            controller.enqueue(encoder.encode(initEvent));

            // Poll for chain updates
            const pollInterval = setInterval(() => {
                void (async () => {
                    try {
                        const currentChain = await chainExecutor.getChain(chainId, workspaceId);
                        if (!currentChain) {
                            clearInterval(pollInterval);
                            controller.close();
                            return;
                        }

                        const latestRun = await chainExecutor.getLatestRun(chainId, workspaceId);
                        const status = latestRun?.status || currentChain.status;
                        const currentStageIndex =
                            latestRun?.currentStageIndex ?? currentChain.currentStageIndex;
                        const findingsCount =
                            latestRun?.aggregatedFindings?.length ?? currentChain.aggregatedFindings.length;

                        // Send progress update
                        const update = {
                            type: "progress",
                            chainId,
                            status,
                            currentStageIndex,
                            findingsCount,
                        };

                        const event = `data: ${JSON.stringify(update)}\n\n`;
                        controller.enqueue(encoder.encode(event));

                        // Close stream if chain completed or failed
                        if (status === "COMPLETED" || status === "FAILED") {
                            const finalEvent = `data: ${JSON.stringify({
                                type: "chain_complete",
                                chainId,
                                status,
                            })}\n\n`;
                            controller.enqueue(encoder.encode(finalEvent));

                            clearInterval(pollInterval);
                            controller.close();
                        }
                    } catch (error) {
                        console.error(`[SSE] Error polling chain ${chainId}:`, error);
                        clearInterval(pollInterval);
                        controller.close();
                    }
                })();
            }, 2000); // Poll every 2 seconds

            // Cleanup on client disconnect
            req.signal.addEventListener("abort", () => {
                clearInterval(pollInterval);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
