export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { businessAnalystService } from "@kletron/server/services/businessAnalystService";
import { FeatureProposalUpdateSchema } from "@kletron/shared/businessAnalystTypes";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

/**
 * GET /api/business-analyst/features/[id]
 * Get a specific feature proposal
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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

        const feature = await businessAnalystService.getFeature(
            workspace._id.toString(),
            params.id
        );
        if (!feature) {
            return NextResponse.json({ error: "Feature not found" }, { status: 404 });
        }
        return NextResponse.json({ feature }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/business-analyst/features/${params.id} GET] Error:`, error);
        return NextResponse.json({ error: "Failed to get feature" }, { status: 500 });
    }
}

/**
 * PUT /api/business-analyst/features/[id]
 * Update a feature proposal
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

        const validation = FeatureProposalUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        await businessAnalystService.updateFeature(
            workspace._id.toString(),
            params.id,
            validation.data as any
        );
        return NextResponse.json({ updated: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/business-analyst/features/${params.id} PUT] Error:`, error);
        return NextResponse.json({ error: "Failed to update feature" }, { status: 500 });
    }
}

/**
 * DELETE /api/business-analyst/features/[id]
 * Delete a feature proposal
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

        await businessAnalystService.deleteFeature(workspace._id.toString(), params.id);
        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/business-analyst/features/${params.id} DELETE] Error:`, error);
        return NextResponse.json({ error: "Failed to delete feature" }, { status: 500 });
    }
}
