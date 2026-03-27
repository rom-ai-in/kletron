export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@kletron/server/services/businessAnalystService";
import { MarketAnalysisCreateSchema } from "@kletron/shared/businessAnalystTypes";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * GET /api/business-analyst/market-analysis
 * Get the latest market analysis for the current workspace
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

        const analysis = await businessAnalystService.getLatestMarketAnalysis(
            workspace._id.toString()
        );
        return NextResponse.json({ analysis }, { status: 200 });
    } catch (error) {
        console.error("[API /api/business-analyst/market-analysis GET] Error:", error);
        return NextResponse.json({ analysis: null }, { status: 200 });
    }
}

/**
 * POST /api/business-analyst/market-analysis
 * Save a new market analysis
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

        const validation = MarketAnalysisCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const analysisId = await businessAnalystService.saveMarketAnalysis(
            workspace._id.toString(),
            validation.data as any
        );
        return NextResponse.json({ analysisId }, { status: 201 });
    } catch (error) {
        console.error("[API /api/business-analyst/market-analysis POST] Error:", error);
        return NextResponse.json({ error: "Failed to save market analysis" }, { status: 500 });
    }
}
