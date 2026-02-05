import { NextResponse } from "next/server";
import { clearVectors } from "@numezis/server/services/vectorService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function DELETE(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }
        await clearVectors(workspace.rootPath);
        return NextResponse.json({
            success: true,
            message: "All vectors cleared for current repository"
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to clear vectors" },
            { status: 500 }
        );
    }
}
