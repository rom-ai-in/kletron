import { NextResponse } from "next/server";
import { getVectorIndexRuns } from "@/src/services/vectorHistoryService";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

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

        const runs = await getVectorIndexRuns(limit, skip);
        return NextResponse.json(runs);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch index history" },
            { status: 500 }
        );
    }
}
