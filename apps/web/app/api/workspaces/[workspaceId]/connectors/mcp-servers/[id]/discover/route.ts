// Connect to a configured external MCP server and refresh its tool list.
// Persists the discovered tools so the UI can show them without reconnecting.

import { NextResponse } from "next/server";
import { probeMcpConnection } from "@kletron/server/lib/mcpDiscoverProbe";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    getExternalMcpRuntimeConfig,
    listMcpServers,
    recordMcpServerStatus,
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

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId, id } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const all = await getExternalMcpRuntimeConfig(workspaceId);
    const target = all.find((s) => s.id === id);
    if (!target) {
        // Fall back to listing without enabled-filter so we can also discover for disabled servers.
        const allServers = await listMcpServers(workspaceId);
        const disabled = allServers.find((s) => s.id === id);
        if (!disabled) {
            return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
        }
    }

    const config = target ?? (await listMcpServers(workspaceId)).find((s) => s.id === id);
    if (!config) return NextResponse.json({ error: "MCP server not found" }, { status: 404 });

    const probe = await probeMcpConnection({
        transport: config.transport,
        command: config.command,
        args: config.args,
        env: "env" in config ? config.env : undefined,
        url: config.url,
        headers: config.headers,
    });

    if (probe.ok) {
        const { tools } = probe;
        await recordMcpServerStatus(workspaceId, id, {
            status: "connected",
            statusMessage: `${tools.length} tools`,
            discoveredTools: tools,
        });
        return NextResponse.json({ ok: true, tools });
    }

    await recordMcpServerStatus(workspaceId, id, {
        status: "error",
        statusMessage: probe.error,
    });
    return NextResponse.json({ ok: false, error: probe.error }, { status: 502 });
}
