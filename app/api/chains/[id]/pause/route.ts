import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * POST /api/chains/[id]/pause
 * Pause a running campaign
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (chain.status !== "RUNNING") {
            return NextResponse.json(
                { error: "Campaign is not running" },
                { status: 400 }
            );
        }

        await chainExecutor.pauseChain(chainId);

        return NextResponse.json({ status: "PAUSED" }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id}/pause POST] Error:`, error);
        return NextResponse.json(
            { error: "Failed to pause campaign" },
            { status: 500 }
        );
    }
}
