// Workspace external MCP servers
//   GET  -> list servers (with discovered tools)
//   POST -> create a new server { name, transport, command?, args?, env?, url?, headers?, enabled? }

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    createMcpServer,
    listMcpServers,
} from "@kletron/server/services/connectorsService";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
} from "@kletron/server/services/workspaceService";
import { mcpServerCreateSchema } from "@kletron/shared";

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

    const servers = await listMcpServers(workspaceId);
    return NextResponse.json({ servers });
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
        const validated = mcpServerCreateSchema.parse(body);
        const server = await createMcpServer(workspaceId, validated);
        return NextResponse.json({ server }, { status: 201 });
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
