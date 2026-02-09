export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * Zod schema for creating an automation
 */
const CreateAutomationSchema = z.object({
    preset: z.string().optional(),
    config: z
        .object({
            name: z.string().min(1).max(200),
            description: z.string().max(1000).optional(),
            stages: z.array(
                z.object({
                    id: z.string().min(1),
                    name: z.string().min(1),
                    prompt: z.string().trim().min(1),
                    graphId: z.string().min(1),
                    llmProvider: z.enum(["azure", "lmstudio"]),
                    llmModel: z.string().optional(),
                    contextFromPreviousStages: z.array(z.string()).optional(),
                    skipIf: z.string().optional(),
                    retryOnFailure: z.boolean().optional(),
                    maxRetries: z.number().int().min(1).max(10).optional(),
                })
            ),
            triggerType: z.enum(["manual", "schedule", "webhook", "git_event"]).optional(),
            schedule: z
                .object({
                    enabled: z.boolean(),
                    cron: z.string(),
                    timezone: z.string(),
                    maxRuns: z.number().int().positive().optional(),
                })
                .optional(),
            webhookConfig: z
                .object({
                    secret: z.string().optional(),
                    allowedIps: z.array(z.string()).optional(),
                })
                .optional(),
            gitEventConfig: z
                .object({
                    events: z.array(z.enum(["push", "pull_request", "tag"])),
                    branches: z.array(z.string()).optional(),
                    secret: z.string().optional(),
                })
                .optional(),
        })
        .optional(),
});

/**
 * GET /api/automations
 * List all automations with optional filtering
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
        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const searchParams = req.nextUrl.searchParams;
        const status = searchParams.get("status");
        const search = searchParams.get("search");
        const scheduledOnly = searchParams.get("scheduledOnly") === "true";
        const triggerType = searchParams.get("triggerType") || undefined;

        const automations = await automationExecutor.listAutomations({
            status: status as any,
            search: search || undefined,
            scheduledOnly,
            triggerType: triggerType as any,
            workspaceId: workspace._id.toString(),
        });

        return NextResponse.json({ automations }, { status: 200 });
    } catch (error) {
        console.error("[API /api/automations GET] Error (returning empty list):", error);
        return NextResponse.json({ automations: [] }, { status: 200 });
    }
}

/**
 * POST /api/automations
 * Create a new automation
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

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, body);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        // Validate input
        const validation = CreateAutomationSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const { preset, config } = validation.data;

        // Build automation from preset or custom config
        let automationConfig;
        if (preset) {
            automationConfig = AutomationConfigBuilder.buildAutomation(preset);
        } else if (config) {
            automationConfig = config;
        } else {
            return NextResponse.json(
                { error: "Either 'preset' or 'config' must be provided" },
                { status: 400 }
            );
        }

        // Validate automation configuration
        const automationValidation = AutomationConfigBuilder.validateAutomationConfig(automationConfig);
        if (!automationValidation.valid) {
            return NextResponse.json(
                { error: "Invalid automation configuration", details: automationValidation.errors },
                { status: 400 }
            );
        }

        // Create automation
        const automationId = await automationExecutor.createAutomation({
            ...(automationConfig as any),
            workspaceId: workspace._id,
        });

        return NextResponse.json({ automationId }, { status: 201 });
    } catch (error) {
        console.error("[API /api/automations POST] Error:", error);
        return NextResponse.json(
            { error: "Failed to create automation" },
            { status: 500 }
        );
    }
}
