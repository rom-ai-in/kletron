import { NextResponse } from "next/server";
import { probeMcpConnection } from "@kletron/server/lib/mcpDiscoverProbe";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import * as accountConnectors from "@kletron/server/services/accountConnectorsService";

export const dynamic = "force-dynamic";

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAppRouteAuth(_request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const all = await accountConnectors.listAccountMcpServers(auth.userId);
    const cfg = all.find((s) => s.id === id);
    if (!cfg) {
        return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
    }

    const probe = await probeMcpConnection({
        transport: cfg.transport,
        command: cfg.command,
        args: cfg.args,
        env: cfg.env,
        url: cfg.url,
        headers: cfg.headers,
    });

    if (probe.ok) {
        const { tools } = probe;
        await accountConnectors.recordAccountMcpServerStatus(auth.userId, id, {
            status: "connected",
            statusMessage: `${tools.length} tools`,
            discoveredTools: tools,
        });
        return NextResponse.json({ ok: true, tools });
    }

    await accountConnectors.recordAccountMcpServerStatus(auth.userId, id, {
        status: "error",
        statusMessage: probe.error,
    });
    return NextResponse.json({ ok: false, error: probe.error }, { status: 502 });
}
