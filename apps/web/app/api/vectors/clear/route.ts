import { NextResponse } from "next/server";
import { clearVectors } from "@kletron/server/services/vectorService";
import { invalidateRefreshCache } from "@kletron/server/services/indexerService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

export async function DELETE(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }
        await clearVectors(workspace.rootPath);
        invalidateRefreshCache(workspace._id.toString());
        return NextResponse.json({
            success: true,
            message: "All vectors cleared for current repository"
        });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        return NextResponse.json(
            { error: "Failed to clear vectors" },
            { status: 500 }
        );
    }
}
