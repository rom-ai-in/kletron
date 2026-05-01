// Resolved capability surface for a workspace.
// Returned shape:
//   {
//     workspaceId: string,
//     enabledTools: string[],
//     enabledIntegrationProviderIds: string[],
//     enabledSkills: ResolvedSkillRecord[],
//     externalMcpServers: ExternalMcpRuntimeConfig[]
//   }
//
// Consumed by:
//   - the bundled MCP server, with the internal-token header
//   - debugging UIs

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceCapabilities } from "@kletron/server/services/workspaceCapabilityResolver";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
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
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const capabilities = await resolveWorkspaceCapabilities(workspaceId);
    // Strip the runtime Set; only the array form serializes.
    const { enabledToolSet, ...payload } = capabilities;
    return NextResponse.json(payload);
}
