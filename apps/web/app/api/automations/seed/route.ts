export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

/**
 * POST /api/automations/seed
 * Seed default feature audit automations (one per domain) into the workspace.
 * Safe to call multiple times — skips automations that already exist by name.
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

        const result = await automationExecutor.ensureDefaultAutomations(workspace._id.toString());

        return NextResponse.json({
            message: `Seeded ${result.created.length} automation(s), skipped ${result.skipped.length}`,
            ...result,
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
