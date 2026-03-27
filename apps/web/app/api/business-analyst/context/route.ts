export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@kletron/server/services/businessAnalystService";
import { BusinessContextUpdateSchema } from "@kletron/shared/businessContext";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * GET /api/business-analyst/context
 * Get the business context for the current workspace
 */
export async function GET(req: NextRequest) {
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

        const context = await businessAnalystService.getBusinessContext(workspace._id.toString());
        return NextResponse.json({ context: context ?? { personas: [], competitors: [] } }, { status: 200 });
    } catch (error) {
        console.error("[API /api/business-analyst/context GET] Error:", error);
        return NextResponse.json({ context: { personas: [], competitors: [] } }, { status: 200 });
    }
}

/**
 * PUT /api/business-analyst/context
 * Update the business context for the current workspace
 */
export async function PUT(req: NextRequest) {
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

        const validation = BusinessContextUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        await businessAnalystService.updateBusinessContext(workspace._id.toString(), validation.data);
        return NextResponse.json({ updated: true }, { status: 200 });
    } catch (error) {
        console.error("[API /api/business-analyst/context PUT] Error:", error);
        return NextResponse.json({ error: "Failed to update business context" }, { status: 500 });
    }
}
