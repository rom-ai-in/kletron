import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * GET /api/chains/[id]/runs
 * List all execution runs for a specific campaign
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;
        const runs = await chainExecutor.listRuns(chainId);

        return NextResponse.json({ runs }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id}/runs GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to list campaign runs" },
            { status: 500 }
        );
    }
}
