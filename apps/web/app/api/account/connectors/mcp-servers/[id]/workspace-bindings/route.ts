import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    applyConnectorWorkspaceBindingsBulk,
    listConnectorWorkspaceBindingsForOwner,
} from "@kletron/server/services/connectorsService";

export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAppRouteAuth(_request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    try {
        const workspaces = await listConnectorWorkspaceBindingsForOwner(auth.userId, "mcp_server", id);
        return NextResponse.json({ workspaces });
    } catch (error) {
        const msg = (error as Error).message;
        if (msg === "MCP server not found") {
            return NextResponse.json({ error: msg }, { status: 404 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    try {
        const body = await request.json();
        await applyConnectorWorkspaceBindingsBulk(auth.userId, "mcp_server", id, body);
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", issues: error.issues },
                { status: 400 }
            );
        }
        const msg = (error as Error).message;
        if (msg === "MCP server not found") {
            return NextResponse.json({ error: msg }, { status: 404 });
        }
        if (msg.startsWith("Workspace not allowed")) {
            return NextResponse.json({ error: msg }, { status: 403 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
