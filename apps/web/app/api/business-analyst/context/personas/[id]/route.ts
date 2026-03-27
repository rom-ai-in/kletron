export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@kletron/server/services/businessAnalystService";
import { UserPersonaCreateSchema } from "@kletron/shared/businessContext";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * PUT /api/business-analyst/context/personas/[id]
 * Update a persona
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await req.json();
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, body);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const validation = UserPersonaCreateSchema.partial().safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        await businessAnalystService.updatePersona(
            workspace._id.toString(),
            params.id,
            validation.data
        );
        return NextResponse.json({ updated: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/business-analyst/context/personas/${params.id} PUT] Error:`, error);
        return NextResponse.json({ error: "Failed to update persona" }, { status: 500 });
    }
}

/**
 * DELETE /api/business-analyst/context/personas/[id]
 * Delete a persona
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        await businessAnalystService.deletePersona(workspace._id.toString(), params.id);
        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/business-analyst/context/personas/${params.id} DELETE] Error:`, error);
        return NextResponse.json({ error: "Failed to delete persona" }, { status: 500 });
    }
}
