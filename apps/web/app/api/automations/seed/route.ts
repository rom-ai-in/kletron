export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

/**
 * POST /api/automations/seed
 * Upserts canonical agent graphs (stable ObjectIds), seeds all automation presets
 * for the workspace, then reconciles legacy stage graph ids. Idempotent.
 */
export async function POST(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null, { requireExplicitWorkspace: true });
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const graphs = await agentGraphService.upsertCanonicalPresetGraphs();
        const result = await automationExecutor.ensureDefaultAutomations(workspace._id.toString());
        const reconciled = await automationExecutor.reconcileAutomationStageGraphs();

        return NextResponse.json({
            message: `Graphs upserted: ${graphs.upserted}, duplicates removed: ${graphs.deletedDuplicateNames}. Seeded ${result.created.length} automation(s), skipped ${result.skipped.length}. Stage graph reconciliations: ${reconciled.updated}.`,
            graphs,
            ...result,
            reconciled,
        }, { status: 200 });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error("[API /api/automations/seed POST] Error:", error);
        return NextResponse.json(
            { error: "Failed to seed automations" },
            { status: 500 }
        );
    }
}
