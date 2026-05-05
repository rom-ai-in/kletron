// Per-workspace skill activation
//   GET  -> list activations + resolved skill metadata for the UI
//   POST -> upsert one activation { skillSlug, enabled, configOverride? }

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    setWorkspaceSkill,
} from "@kletron/server/services/skillsService";
import { listWorkspaceSkillViews } from "@kletron/server/services/workspaceSkillStateService";
import { getWorkspaceByIdUnsafe, getWorkspaceById } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

async function assertWorkspaceAccess(workspaceId: string, auth: { userId: string; authType: string }) {
    if (auth.authType === "internal") {
        return getWorkspaceByIdUnsafe(workspaceId);
    }
    return getWorkspaceById(workspaceId, auth.userId);
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;
    const workspace = await assertWorkspaceAccess(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const viewerUserId = auth.authType === "internal" ? null : auth.userId;
    const { activations, skills } = await listWorkspaceSkillViews(workspaceId, viewerUserId);

    return NextResponse.json({
        workspaceId,
        activations,
        skills,
    });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;
    const workspace = await assertWorkspaceAccess(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const skillSlug = typeof body.skillSlug === "string" ? body.skillSlug : null;
    if (!skillSlug) {
        return NextResponse.json({ error: "skillSlug is required" }, { status: 400 });
    }
    const enabled =
        body.enabled === undefined
            ? undefined
            : body.enabled !== false;
    const autoLoadInNewThreads =
        body.autoLoadInNewThreads === undefined ? undefined : body.autoLoadInNewThreads === true;
    const configOverride =
        body.configOverride && typeof body.configOverride === "object"
            ? body.configOverride
            : undefined;

    try {
        const activation = await setWorkspaceSkill(
            workspaceId,
            skillSlug,
            enabled,
            autoLoadInNewThreads,
            configOverride,
        );
        return NextResponse.json({ activation });
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
