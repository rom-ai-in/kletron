import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    deleteWorkspace,
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
    toWorkspaceSummary,
} from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;

    const workspace =
        auth.authType === "internal"
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : await getWorkspaceById(workspaceId, auth.userId);

    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ workspace: toWorkspaceSummary(workspace) });
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;

    const workspace =
        auth.authType === "internal"
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : await getWorkspaceById(workspaceId, auth.userId);

    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ownerId = workspace.ownerId ?? auth.userId;
    const ok = await deleteWorkspace(workspaceId, ownerId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
