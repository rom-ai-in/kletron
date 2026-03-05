import { NextRequest, NextResponse } from "next/server";
import { startIndexing } from "@numezis/server/services/indexerService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@numezis/server/services/workspaceService";

export async function POST(request: NextRequest) {
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
        const repoPath = workspace.rootPath;

        // Force reindex in the background
        void startIndexing(workspace._id.toString(), repoPath, true);

        return NextResponse.json({
            success: true,
            message: "Reindexing started in background"
        });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to start reindexing" },
            { status: 500 }
        );
    }
}
