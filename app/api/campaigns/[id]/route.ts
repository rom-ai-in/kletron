import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chainExecutor } from "@/src/services/chainExecutor";
import { ChainConfigBuilder } from "@/src/services/chainConfigBuilder";

/**
 * Zod schema for updating a campaign
 */
const UpdateChainSchema = z.object({
    config: z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        stages: z.array(
            z.object({
                id: z.string().min(1),
                name: z.string().min(1),
                graphId: z.enum(["audit", "simple_react"]),
                promptPath: z.string().min(1),
                llmProvider: z.enum(["azure", "lmstudio"]),
                llmModel: z.string().optional(),
                contextFromPreviousStages: z.array(z.string()).optional(),
                skipIf: z.string().optional(),
                retryOnFailure: z.boolean().optional(),
                maxRetries: z.number().int().min(1).max(10).optional(),
            })
        ),
        schedule: z
            .object({
                enabled: z.boolean(),
                cron: z.string(),
                timezone: z.string(),
                maxRuns: z.number().int().positive().optional(),
            })
            .optional(),
    }),
});

/**
 * GET /api/campaigns/[id]
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

        const latestRun = await chainExecutor.getLatestRun(chainId);

        if (latestRun) {
            // Merge latest run stats/results into the chain object for UI compatibility
            Object.assign(chain, {
                status: latestRun.status,
                startedAt: latestRun.startedAt,
                endedAt: latestRun.endedAt,
                currentStageIndex: latestRun.currentStageIndex,
                sessionIds: latestRun.sessionIds,
                aggregatedFindings: latestRun.aggregatedFindings,
                crossStageInsights: latestRun.crossStageInsights,
                finalReport: latestRun.finalReport,
                metadata: latestRun.metadata,
                latestRunId: latestRun._id?.toString()
            });
        }

        return NextResponse.json({ chain, latestRun }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/campaigns/${params.id} GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get campaign" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/campaigns/[id]
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
        console.error(`[API /api/campaigns/${params.id} DELETE] Error:`, error);
        return NextResponse.json(
            { error: "Failed to delete campaign" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/campaigns/[id]
 * Update a campaign
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const chainId = params.id;
        const body = await req.json();

        // Validate input
        const validation = UpdateChainSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const { config } = validation.data;

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

        // Validate chain configuration
        const chainValidation = ChainConfigBuilder.validateChainConfig(config);
        if (!chainValidation.valid) {
            return NextResponse.json(
                { error: "Invalid chain configuration", details: chainValidation.errors },
                { status: 400 }
            );
        }

        await chainExecutor.updateChain(chainId, config);

        return NextResponse.json({ updated: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/campaigns/${params.id} PUT] Error:`, error);
        return NextResponse.json(
            { error: "Failed to update campaign" },
            { status: 500 }
        );
    }
}
