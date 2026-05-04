import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { removeWorkspaceSkill } from "@kletron/server/services/skillsService";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
} from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string; slug: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId, slug } = await params;
    const workspace =
        auth.authType === "internal"
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : await getWorkspaceById(workspaceId, auth.userId);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const ok = await removeWorkspaceSkill(workspaceId, slug);
    return NextResponse.json({ ok });
}
