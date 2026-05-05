import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import * as accountConnectors from "@kletron/server/services/accountConnectorsService";
import * as bindings from "@kletron/server/services/connectorBindingsService";
import { mcpServerUpdateSchema } from "@kletron/shared";

export const dynamic = "force-dynamic";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    try {
        const body = await request.json();
        const validated = mcpServerUpdateSchema.parse(body);
        const server = await accountConnectors.updateAccountMcpServer(auth.userId, id, validated);
        if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ server });
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

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await bindings.deleteAllBindingsForMcpRef(id);
    const ok = await accountConnectors.deleteAccountMcpServer(auth.userId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
