// Account-level MCP library (owner = signed-in user). Bindings are per-workspace.

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import * as accountConnectors from "@kletron/server/services/accountConnectorsService";
import { mcpServerCreateSchema } from "@kletron/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const servers = await accountConnectors.listAccountMcpServers(auth.userId);
    return NextResponse.json({ servers });
}

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const validated = mcpServerCreateSchema.parse(body);
        const server = await accountConnectors.createAccountMcpServer(auth.userId, validated);
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
