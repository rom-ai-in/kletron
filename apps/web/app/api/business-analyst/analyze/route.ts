export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

const AnalyzeSchema = z.object({
    preset: z.enum([
        "BUSINESS_ANALYSIS_FULL",
        "QUICK_FEATURE_BRAINSTORM",
        "COMPETITIVE_DEEP_DIVE",
    ]),
});

/**
 * POST /api/business-analyst/analyze
 * Create a Business Analyst automation and immediately start a run
 */
export async function POST(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

        const validation = AnalyzeSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const automationConfig = AutomationConfigBuilder.buildAutomation(validation.data.preset);

        const automationId = await automationExecutor.createAutomation({
            ...(automationConfig as any),
            workspaceId: workspace._id,
        });

        // Start a run immediately so the user sees execution begin
        const runId = await automationExecutor.startNewRun(automationId, workspace._id.toString());

        // Execute run in background (fire-and-forget)
        runWithWorkspaceContext(workspace, () => {
            automationExecutor.executeRun(runId).catch((error) => {
                console.error(`[BA Analyze] Run ${runId} (Automation ${automationId}) failed:`, error);
            });
        });

        return NextResponse.json({ automationId, runId }, { status: 201 });
    } catch (error) {
        console.error("[API /api/business-analyst/analyze POST] Error:", error);
        return NextResponse.json({ error: "Failed to start analysis" }, { status: 500 });
    }
}
