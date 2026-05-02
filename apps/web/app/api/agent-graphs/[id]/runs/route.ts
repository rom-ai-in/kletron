export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { getGraphNodeOrder, buildInitialState } from "@kletron/server/services/agentGraphRuntime";
import { preflightMissionForNewRun } from "@kletron/server/services/skillSlashPreflight";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";
import { runWithWorkspaceContext } from "@kletron/server/workspace/workspaceContext";

const CreateRunSchema = z.object({
    mission: z.string().optional(),
});

/**
 * GET /api/agent-graphs/[id]/runs
 * List runs for a graph
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
          return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
        const workspaceId = workspace?._id?.toString();
        const runs = await agentGraphRunService.listRuns(params.id, 30, workspaceId);
        return NextResponse.json({ runs }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/agent-graphs/${params.id}/runs GET] Error:`, error);
        return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
    }
}

/**
 * POST /api/agent-graphs/[id]/runs
 * Create a new run and execute asynchronously.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
          return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const graph = await agentGraphService.getGraph(params.id);
        if (!graph) {
            return NextResponse.json({ error: "Graph not found" }, { status: 404 });
        }

        const body = await req.json().catch(() => ({}));
        const validation = CreateRunSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const workspace = await resolveWorkspaceFromRequest(req, auth.userId, body);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const nodeOrder = getGraphNodeOrder(graph as any);
        const runId = await agentGraphRunService.createRun(params.id, workspace._id.toString(), "agent");

        const initialNodeStatuses: Record<string, any> = {};
        for (const node of graph.nodes) {
            initialNodeStatuses[node.id] = "PENDING";
        }

        const rawMission = validation.data.mission ?? "";
        const pre = await preflightMissionForNewRun(rawMission, workspace._id.toString());
        const initialState = {
            ...buildInitialState(graph as any, pre.mission),
            mission: pre.mission,
            userInput: pre.mission,
            loadedSkillIds: pre.loadedSkillIds.length ? pre.loadedSkillIds : undefined,
            skillLoads: pre.skillLoads.length ? pre.skillLoads : undefined,
        };

        await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
            nodeOrder,
            nodeStatuses: initialNodeStatuses,
            state: initialState,
        } as any);

        // Execute in the background (best-effort). The executor updates the run record.
        void (async () => {
            try {
                const { agentGraphExecutor } = await import("@kletron/server/services/agentGraphExecutor");
                await runWithWorkspaceContext(workspace, async () => {
                    await agentGraphExecutor.executeRun(runId);
                });
            } catch (err: any) {
                console.error(`[AgentGraphRun] Background execution failed run=${runId}`, err);
                try {
                    await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                        endedAt: new Date(),
                        error: err?.message ?? String(err),
                    } as any);
                } catch (dbErr) {
                    console.error(`[AgentGraphRun] Failed to update run status run=${runId}`, dbErr);
                }
            }
        })();

        return NextResponse.json({ runId }, { status: 201 });
    } catch (error) {
        console.error(`[API /api/agent-graphs/${params.id}/runs POST] Error:`, error);
        return NextResponse.json({ error: "Failed to start run" }, { status: 500 });
    }
}
