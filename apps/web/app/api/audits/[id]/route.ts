import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@kletron/server/lib/db";
import { ObjectId } from "mongodb";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {

  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

    try {
        const { id: sessionId } = await params;
        const db = await getDb();

        // Validate ObjectId format
        if (!ObjectId.isValid(sessionId)) {
            return NextResponse.json({ error: "Invalid session ID format" }, { status: 400 });
        }

        const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);

        // Scope query to the active workspace when available
        const filter: Record<string, unknown> = { _id: new ObjectId(sessionId) };
        if (workspace?._id) {
            filter.workspaceId = new ObjectId(workspace._id.toString());
        }

        const session = await db
            .collection("audit_sessions")
            .findOne(filter);

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        return NextResponse.json(session);
    } catch (error) {
        console.error("Failed to fetch audit session:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
