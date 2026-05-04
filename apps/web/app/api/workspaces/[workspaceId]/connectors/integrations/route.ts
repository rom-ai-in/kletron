// Workspace SaaS integrations
//   GET  -> list integrations (credentials masked)
//   POST -> create a new integration { providerId, displayName?, credentials, scopes? }

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    createIntegration,
    listIntegrations,
} from "@kletron/server/services/connectorsService";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
} from "@kletron/server/services/workspaceService";
import { integrationCreateSchema } from "@kletron/shared";

export const dynamic = "force-dynamic";

async function loadWorkspace(workspaceId: string, auth: { userId: string; authType: string }) {
    if (auth.authType === "internal") return getWorkspaceByIdUnsafe(workspaceId);
    return getWorkspaceById(workspaceId, auth.userId);
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const integrations = await listIntegrations(workspaceId);
    return NextResponse.json({ integrations });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    try {
        const body = await request.json();
        const validated = integrationCreateSchema.parse(body);
        const integration = await createIntegration(workspaceId, validated);
        return NextResponse.json({ integration }, { status: 201 });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", issues: error.issues },
                { status: 400 }
            );
        }
        const message = (error as Error).message;
        const status = /unknown connector|missing required/i.test(message) ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
