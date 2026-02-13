import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";
import { LLM_PROVIDERS } from "@numezis/shared/schemas/llmConfig.schema";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

/**
 * Zod schema for updating an automation
 */
const UpdateAutomationSchema = z.object({
    config: z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        stages: z.array(
            z.object({
                id: z.string().min(1),
                name: z.string().min(1),
                prompt: z.string().trim().min(1),
                graphId: z.string().min(1),
                llmProvider: z.enum(LLM_PROVIDERS),
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
    }),
});

/**
 * GET /api/automations/[id]
 * Get automation details by ID
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

    try {
        const automationId = params.id;

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());

        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        const latestRun = await automationExecutor.getLatestRun(automationId, workspace._id.toString());

        if (latestRun) {
            // Merge latest run stats/results into the automation object for UI compatibility
            Object.assign(automation, {
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

        // Compute webhook URL for webhook/git_event trigger types
        let webhookUrl: string | undefined;
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || req.nextUrl.origin;

        if (automation.triggerType === "webhook") {
            webhookUrl = `${baseUrl}/api/automations/${automationId}/webhook`;
        } else if (automation.triggerType === "git_event") {
            webhookUrl = `${baseUrl}/api/webhooks/git`;
        }

        return NextResponse.json({ automation, latestRun, webhookUrl }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/automations/${params.id} GET] Error:`, error);
        return NextResponse.json(
            { error: "Failed to get automation" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/automations/[id]
 * Delete an automation
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

    try {
        const automationId = params.id;

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());

        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        // Don't allow deleting running automations
        if (automation.status === "RUNNING") {
            return NextResponse.json(
                { error: "Cannot delete a running automation. Pause it first." },
                { status: 400 }
            );
        }

        await automationExecutor.deleteAutomation(automationId, workspace._id.toString());

        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/automations/${params.id} DELETE] Error:`, error);
        return NextResponse.json(
            { error: "Failed to delete automation" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/automations/[id]
 * Update an automation
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

    try {
        const automationId = params.id;
        const body = await req.json();

        // Validate input
        const validation = UpdateAutomationSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const { config } = validation.data;

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, body);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const automation = await automationExecutor.getAutomation(automationId, workspace._id.toString());

        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        // Don't allow editing running automations
        if (automation.status === "RUNNING") {
            return NextResponse.json(
                { error: "Cannot edit a running automation. Pause it first." },
                { status: 400 }
            );
        }

        // Validate automation configuration
        const automationValidation = AutomationConfigBuilder.validateAutomationConfig(config);
        if (!automationValidation.valid) {
            return NextResponse.json(
                { error: "Invalid automation configuration", details: automationValidation.errors },
                { status: 400 }
            );
        }

        await automationExecutor.updateAutomation(automationId, config, workspace._id.toString());

        return NextResponse.json({ updated: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/automations/${params.id} PUT] Error:`, error);
        return NextResponse.json(
            { error: "Failed to update automation" },
            { status: 500 }
        );
    }
}
