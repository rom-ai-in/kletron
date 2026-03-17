export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { businessAnalystService } from "@kletron/server/services/businessAnalystService";
import { FeatureProposalCreateSchema } from "@kletron/shared/businessAnalystTypes";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

const BulkImportSchema = z.object({
    features: z.array(FeatureProposalCreateSchema).min(1).max(200),
});

/**
 * POST /api/business-analyst/features/bulk-import
 * Bulk import feature proposals (e.g., from AI analysis)
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

        const validation = BulkImportSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const count = await businessAnalystService.bulkImportFeatures(
            workspace._id.toString(),
            validation.data.features as any[]
        );
        return NextResponse.json({ imported: count }, { status: 201 });
    } catch (error) {
        console.error("[API /api/business-analyst/features/bulk-import POST] Error:", error);
        return NextResponse.json({ error: "Failed to bulk import features" }, { status: 500 });
    }
}
