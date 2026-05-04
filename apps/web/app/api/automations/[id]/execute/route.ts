import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";
import { runWithWorkspaceContext } from "@kletron/server/workspace/workspaceContext";

/**
 * PUT /api/automations/[id]/execute
 * Start automation execution as an agent thread (non-blocking).
 * Returns the threadId so the client can navigate to /app/agent?sessionId=<threadId>.
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const automationId = params.id;

        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null, { requireExplicitWorkspace: true });
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());
        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        const promptIssues = automation.stages
            .map((stage, index) => {
                if (stage.prompt && stage.prompt.trim().length > 0) return null;
                return { index, stageId: stage.id, stageName: stage.name };
            })
            .filter(Boolean);

        if (promptIssues.length > 0) {
            return NextResponse.json(
                {
                    error: "Automation blocked: one or more stages are missing prompts",
                    details: promptIssues,
                },
                { status: 400 }
            );
        }

        // Kick off the automation thread inside the workspace context.
        let threadId: string | undefined;
        await runWithWorkspaceContext(workspace, async () => {
            const result = await automationExecutor.runAutomationAsThread(
                automationId,
                workspace._id?.toString()
            );
            threadId = result.threadId;
        });

        if (!threadId) {
            return NextResponse.json({ error: "Failed to start automation thread" }, { status: 500 });
        }

        return NextResponse.json({ status: "STARTED", threadId }, { status: 200 });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error(`[API /api/automations/${params.id}/execute PUT] Error:`, error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to start automation execution" },
            { status: 500 }
        );
    }
}
