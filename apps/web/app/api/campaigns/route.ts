export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chainExecutor } from "@numezis/server/services/chainExecutor";
import { ChainConfigBuilder } from "@numezis/shared/chainConfigBuilder";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

/**
 * Zod schema for creating a chain
 */
const CreateChainSchema = z.object({
    preset: z.string().optional(),
    config: z
        .object({
            name: z.string().min(1).max(200),
            description: z.string().max(1000).optional(),
            stages: z.array(
                z.object({
                    id: z.string().min(1),
                    name: z.string().min(1),
                    graphId: z.enum(["audit", "simple_react"]),
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
        })
        .optional(),
});

/**
 * GET /api/campaigns
 * List all campaigns with optional filtering
 */
export async function GET(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const searchParams = req.nextUrl.searchParams;
        const status = searchParams.get("status");
        const search = searchParams.get("search");
        const scheduledOnly = searchParams.get("scheduledOnly") === "true";

        const chains = await chainExecutor.listChains({
            status: status as any,
            search: search || undefined,
            scheduledOnly,
        });

        return NextResponse.json({ chains }, { status: 200 });
    } catch (error) {
        console.error("[API /api/campaigns GET] Error (returning empty list):", error);
        return NextResponse.json({ chains: [] }, { status: 200 });
    }
}

/**
 * POST /api/campaigns
 * Create a new campaign
 */
export async function POST(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await req.json();

        // Validate input
        const validation = CreateChainSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const { preset, config } = validation.data;

        // Build chain from preset or custom config
        let chainConfig;
        if (preset) {
            chainConfig = ChainConfigBuilder.buildChain(preset);
        } else if (config) {
            chainConfig = config;
        } else {
            return NextResponse.json(
                { error: "Either 'preset' or 'config' must be provided" },
                { status: 400 }
            );
        }

        // Validate chain configuration
        const chainValidation = ChainConfigBuilder.validateChainConfig(chainConfig);
        if (!chainValidation.valid) {
            return NextResponse.json(
                { error: "Invalid chain configuration", details: chainValidation.errors },
                { status: 400 }
            );
        }

        // Create chain
        const chainId = await chainExecutor.createChain(chainConfig as any);

        return NextResponse.json({ chainId }, { status: 201 });
    } catch (error) {
        console.error("[API /api/campaigns POST] Error:", error);
        return NextResponse.json(
            { error: "Failed to create campaign" },
            { status: 500 }
        );
    }
}
