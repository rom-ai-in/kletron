import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { testIntegration } from "@kletron/server/services/connectorsService";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
} from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

async function loadWorkspace(workspaceId: string, auth: { userId: string; authType: string }) {
    if (auth.authType === "internal") return getWorkspaceByIdUnsafe(workspaceId);
    return getWorkspaceById(workspaceId, auth.userId);
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId, id } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    const result = await testIntegration(workspaceId, id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
