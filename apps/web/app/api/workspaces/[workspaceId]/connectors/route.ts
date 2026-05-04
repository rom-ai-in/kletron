// Compatibility wrapper: returns a flat list of integrations + MCP servers
// for callers that expected the old shape. Prefer:
//   /api/workspaces/[workspaceId]/connectors/integrations
//   /api/workspaces/[workspaceId]/connectors/mcp-servers

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    listIntegrations,
    listMcpServers,
} from "@kletron/server/services/connectorsService";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
} from "@kletron/server/services/workspaceService";

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
    const [integrations, servers] = await Promise.all([
        listIntegrations(workspaceId),
        listMcpServers(workspaceId),
    ]);
    return NextResponse.json({ integrations, mcpServers: servers });
}
