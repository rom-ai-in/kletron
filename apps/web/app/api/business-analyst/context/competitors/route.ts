export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@kletron/server/services/businessAnalystService";
import { CompetitorCreateSchema } from "@kletron/shared/businessContext";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * POST /api/business-analyst/context/competitors
 * Add a new competitor to the business context
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

        const validation = CompetitorCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const competitorId = await businessAnalystService.addCompetitor(
            workspace._id.toString(),
            validation.data
        );
        return NextResponse.json({ competitorId }, { status: 201 });
    } catch (error) {
        console.error("[API /api/business-analyst/context/competitors POST] Error:", error);
        return NextResponse.json({ error: "Failed to add competitor" }, { status: 500 });
    }
}
