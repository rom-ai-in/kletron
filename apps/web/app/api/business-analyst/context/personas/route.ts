export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@kletron/server/services/businessAnalystService";
import { UserPersonaCreateSchema } from "@kletron/shared/businessContext";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * POST /api/business-analyst/context/personas
 * Add a new persona to the business context
 */
export async function POST(req: NextRequest) {
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

        const validation = UserPersonaCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const personaId = await businessAnalystService.addPersona(
            workspace._id.toString(),
            validation.data
        );
        return NextResponse.json({ personaId }, { status: 201 });
    } catch (error) {
        console.error("[API /api/business-analyst/context/personas POST] Error:", error);
        return NextResponse.json({ error: "Failed to add persona" }, { status: 500 });
    }
}
