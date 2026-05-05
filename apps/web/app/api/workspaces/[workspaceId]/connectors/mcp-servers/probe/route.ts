// Ephemeral MCP probe from the Edit MCP dialog — uses request body only; does not read or write Mongo.

import { mcpServerProbeSchema } from "@kletron/shared";
import { NextResponse } from "next/server";
import { probeMcpConnection } from "@kletron/server/lib/mcpDiscoverProbe";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
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
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = mcpServerProbeSchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((e) => e.message).join("; ") || "Invalid payload";
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const result = await probeMcpConnection(parsed.data);
    if (result.ok) {
        return NextResponse.json({ ok: true, tools: result.tools });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
}
