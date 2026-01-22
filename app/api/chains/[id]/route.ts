import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * GET /api/chains/[id]
 * Get chain details by ID
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Chain not found" }, { status: 404 });
        }

        return NextResponse.json({ chain }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id} GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get chain" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/chains/[id]
 * Delete a chain
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Chain not found" }, { status: 404 });
        }

        // Don't allow deleting running chains
        if (chain.status === "RUNNING") {
            return NextResponse.json(
                { error: "Cannot delete a running chain. Pause it first." },
                { status: 400 }
            );
        }

        await chainExecutor.deleteChain(chainId);

        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id} DELETE] Error:`, error);
        return NextResponse.json(
            { error: "Failed to delete chain" },
            { status: 500 }
        );
    }
}
