import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import * as accountConnectors from "@kletron/server/services/accountConnectorsService";
import { deleteAccountIntegrationForUser } from "@kletron/server/services/connectorsService";
import { integrationUpdateSchema } from "@kletron/shared";

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
        const validated = integrationUpdateSchema.parse(body);
        const integration = await accountConnectors.updateAccountIntegration(auth.userId, id, validated);
        if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ integration });
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
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAppRouteAuth(_request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const ok = await deleteAccountIntegrationForUser(auth.userId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
