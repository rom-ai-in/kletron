import { NextRequest, NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";
import { buildAutomationExecutionContext } from "@kletron/server/services/automationExecutionContextService";

/**
 * GET /api/automations/[id]/execution-context
 * Effective workspace + capabilities + per-stage graph tool visibility for UI.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const automationId = params.id;
        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null, {
            requireExplicitWorkspace: true,
        });
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const wid = workspace._id.toString();
        const context = await buildAutomationExecutionContext(automationId, wid);
        if (!context) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        return NextResponse.json({ executionContext: context }, { status: 200 });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error(`[API /api/automations/${params.id}/execution-context GET] Error:`, error);
        return NextResponse.json({ error: "Failed to load execution context" }, { status: 500 });
    }
}
