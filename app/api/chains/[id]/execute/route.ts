import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * PUT /api/chains/[id]/execute
 * Start campaign execution (non-blocking)
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (chain.status === "RUNNING") {
            return NextResponse.json(
                { error: "Campaign is already running" },
                { status: 400 }
            );
        }

        // Execute chain in background (don't await)
        chainExecutor.executeChain(chainId).catch((error) => {
            console.error(`[ChainExecution] Chain ${chainId} failed:`, error);
        });

        return NextResponse.json({ status: "STARTED" }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id}/execute PUT] Error:`, error);
        return NextResponse.json(
            { error: "Failed to start campaign execution" },
            { status: 500 }
        );
    }
}
