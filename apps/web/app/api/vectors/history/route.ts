import { NextResponse } from "next/server";
import { getVectorIndexRuns } from "@numezis/server/services/vectorHistoryService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = parseInt(searchParams.get("skip") || "0");

        const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
        const workspaceId = workspace?._id?.toString();
        const runs = await getVectorIndexRuns(limit, skip, workspaceId);
        return NextResponse.json(runs);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch index history" },
            { status: 500 }
        );
    }
}
