import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    deleteIntegration,
    updateIntegration,
} from "@kletron/server/services/connectorsService";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
} from "@kletron/server/services/workspaceService";
import { integrationUpdateSchema } from "@kletron/shared";

export const dynamic = "force-dynamic";

async function loadWorkspace(workspaceId: string, auth: { userId: string; authType: string }) {
    if (auth.authType === "internal") return getWorkspaceByIdUnsafe(workspaceId);
    return getWorkspaceById(workspaceId, auth.userId);
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId, id } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    try {
        const body = await request.json();
        const validated = integrationUpdateSchema.parse(body);
        const integration = await updateIntegration(workspaceId, id, validated);
        if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ integration });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", issues: error.issues },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId, id } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    const ok = await deleteIntegration(workspaceId, id);
    return NextResponse.json({ ok });
}
