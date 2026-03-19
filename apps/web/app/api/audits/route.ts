import { NextResponse } from "next/server";
import { getDb } from "@kletron/server/lib/db";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
        const db = await getDb();

        // Scope audit sessions to the active workspace
        const filter: Record<string, unknown> = {};
        if (workspace?._id) {
            filter.workspaceId = new ObjectId(workspace._id.toString());
        }

        // Project only necessary fields for the list view to optimize bandwidth
        const sessions = await db
            .collection("audit_sessions")
            .find(filter)
            .project({
                _id: 1,
                prompt: 1,
                status: 1,
                startedAt: 1,
                endedAt: 1,
                "workflowResult.conclusion": 1,
                lastUpdated: 1
            })
            .sort({ startedAt: -1 }) // Newest first
            .limit(50) // Pagination limit
            .toArray();

        return NextResponse.json(sessions);
    } catch (error) {
        console.error("Failed to fetch audit sessions:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
