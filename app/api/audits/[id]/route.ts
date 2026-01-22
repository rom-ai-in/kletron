import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../src/lib/db";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const db = await getDb();
        const sessionId = params.id;

        // Validate ObjectId format
        if (!ObjectId.isValid(sessionId)) {
            return NextResponse.json({ error: "Invalid session ID format" }, { status: 400 });
        }

        const session = await db
            .collection("audit_sessions")
            .findOne({ _id: new ObjectId(sessionId) });

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
