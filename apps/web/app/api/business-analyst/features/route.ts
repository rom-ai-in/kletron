export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@numezis/server/services/businessAnalystService";
import { FeatureProposalCreateSchema, FeatureFilterSchema } from "@numezis/shared/businessAnalystTypes";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@numezis/server/services/workspaceService";

/**
 * GET /api/business-analyst/features
 * List feature proposals with optional filtering
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
        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const searchParams = req.nextUrl.searchParams;
        const rawFilter: Record<string, any> = {};
        if (searchParams.get("type")) rawFilter.type = searchParams.get("type");
        if (searchParams.get("status")) rawFilter.status = searchParams.get("status");
        if (searchParams.get("source")) rawFilter.source = searchParams.get("source");
        if (searchParams.get("search")) rawFilter.search = searchParams.get("search");
        if (searchParams.get("personaId")) rawFilter.personaId = searchParams.get("personaId");
        const minPriorityRaw = searchParams.get("minPriority");
        if (minPriorityRaw) {
            const parsed = Number(minPriorityRaw);
            if (!isNaN(parsed)) rawFilter.minPriority = parsed;
        }

        const filterResult = FeatureFilterSchema.safeParse(rawFilter);
        const filter = filterResult.success ? filterResult.data : {};

        const features = await businessAnalystService.listFeatures(
            workspace._id.toString(),
            filter
        );
        return NextResponse.json({ features }, { status: 200 });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error("[API /api/business-analyst/features GET] Error:", error);
        return NextResponse.json({ features: [] }, { status: 200 });
    }
}

/**
 * POST /api/business-analyst/features
 * Create a new feature proposal
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
        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, body);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const validation = FeatureProposalCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const featureId = await businessAnalystService.createFeature(
            workspace._id.toString(),
            validation.data as any
        );
        return NextResponse.json({ featureId }, { status: 201 });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error("[API /api/business-analyst/features POST] Error:", error);
        return NextResponse.json({ error: "Failed to create feature" }, { status: 500 });
    }
}
