import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * POST /api/chains/[id]/resume
 * Resume a paused chain
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Chain not found" }, { status: 404 });
        }

        if (chain.status !== "PAUSED") {
            return NextResponse.json(
                { error: "Chain is not paused" },
                { status: 400 }
            );
        }

        // Resume chain in background
        chainExecutor.resumeChain(chainId).catch((error) => {
            console.error(`[ChainResume] Chain ${chainId} failed:`, error);
        });

        return NextResponse.json({ status: "RUNNING" }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id}/resume POST] Error:`, error);
        return NextResponse.json(
            { error: "Failed to resume chain" },
            { status: 500 }
        );
    }
}
