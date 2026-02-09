import { NextRequest } from "next/server";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * GET /api/automations/[id]/stream
 * Server-Sent Events stream for real-time automation execution updates
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

    const automationId = params.id;

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    if (!workspace || !workspace._id) {
        return new Response("Workspace not configured", { status: 400 });
    }
    const workspaceId = workspace._id.toString();

    // Verify automation exists
    const automation = await automationExecutor.getAutomation(automationId, workspaceId);
    if (!automation) {
        return new Response("Automation not found", { status: 404 });
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Send initial connection event
            const initEvent = `data: ${JSON.stringify({ type: "connected", automationId })}\n\n`;
            controller.enqueue(encoder.encode(initEvent));

            // Poll for automation updates
            const pollInterval = setInterval(() => {
                void (async () => {
                    try {
                        const currentAutomation = await automationExecutor.getAutomation(automationId, workspaceId);
                        if (!currentAutomation) {
                            clearInterval(pollInterval);
                            controller.close();
                            return;
                        }

                        const latestRun = await automationExecutor.getLatestRun(automationId, workspaceId);
                        const status = latestRun?.status || currentAutomation.status;
                        const currentStageIndex =
                            latestRun?.currentStageIndex ?? currentAutomation.currentStageIndex;
                        const findingsCount =
                            latestRun?.aggregatedFindings?.length ?? currentAutomation.aggregatedFindings.length;

                        // Send progress update
                        const update = {
                            type: "progress",
                            automationId,
                            status,
                            currentStageIndex,
                            findingsCount,
                        };

                        const event = `data: ${JSON.stringify(update)}\n\n`;
                        controller.enqueue(encoder.encode(event));

                        // Close stream if automation completed or failed
                        if (status === "COMPLETED" || status === "FAILED") {
                            const finalEvent = `data: ${JSON.stringify({
                                type: "automation_complete",
                                automationId,
                                status,
                            })}\n\n`;
                            controller.enqueue(encoder.encode(finalEvent));

                            clearInterval(pollInterval);
                            controller.close();
                        }
                    } catch (error) {
                        console.error(`[SSE] Error polling automation ${automationId}:`, error);
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
