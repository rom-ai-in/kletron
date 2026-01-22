import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * GET /api/chains/[id]
 * Get campaign details by ID
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        return NextResponse.json({ chain }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id} GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get campaign" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/chains/[id]
 * Delete a campaign
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        // Don't allow deleting running chains
        if (chain.status === "RUNNING") {
            return NextResponse.json(
                { error: "Cannot delete a running campaign. Pause it first." },
                { status: 400 }
            );
        }

        await chainExecutor.deleteChain(chainId);

        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id} DELETE] Error:`, error);
        return NextResponse.json(
            { error: "Failed to delete campaign" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/chains/[id]
 * Update a campaign
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;
        const body = await req.json();
        const { config } = body;

        if (!config) {
            return NextResponse.json({ error: "Missing config in request body" }, { status: 400 });
        }

        const chain = await chainExecutor.getChain(chainId);

        if (!chain) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        // Don't allow editing running chains
        if (chain.status === "RUNNING") {
            return NextResponse.json(
                { error: "Cannot edit a running campaign. Pause it first." },
                { status: 400 }
            );
        }

        await chainExecutor.updateChain(chainId, config);

        return NextResponse.json({ updated: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/chains/${params.id} PUT] Error:`, error);
        return NextResponse.json(
            { error: "Failed to update campaign" },
            { status: 500 }
        );
    }
}
