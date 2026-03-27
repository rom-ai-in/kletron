export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    buildSimpleReactAgentGraph,
    buildDriftAnalysisGraph,
    buildCoderAgentGraph,
    buildExplorerAgentGraph,
    buildPlannerAgentGraph,
    buildBusinessAnalystGraph,
} from "@kletron/server/services/agentGraphPresets";

/** Map of graph name → builder for all preset graphs. */
const PRESET_BUILDERS: Record<string, () => ReturnType<typeof buildSimpleReactAgentGraph>> = {
    "Simple ReAct (agent graph)": buildSimpleReactAgentGraph,
    "Drift Analysis (agent graph)": buildDriftAnalysisGraph,
    "Coder Agent (agent graph)": buildCoderAgentGraph,
    "Explorer Agent (agent graph)": buildExplorerAgentGraph,
    "Planner Agent (agent graph)": buildPlannerAgentGraph,
    "Business Analyst": buildBusinessAnalystGraph,
};

/**
 * POST /api/agent-graphs/[id]/reset
 * Resets the graph's node system prompts and tool lists to the preset defaults.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const graph = await agentGraphService.getGraph(params.id);
        if (!graph) {
            return NextResponse.json({ error: "Graph not found" }, { status: 404 });
        }

        const builder = PRESET_BUILDERS[graph.name];
        if (!builder) {
            return NextResponse.json(
                { error: "No preset found for this graph. Only preset graphs can be reset to defaults." },
                { status: 400 }
            );
        }

        const preset = builder();

        await agentGraphService.updateGraph(params.id, {
            nodes: preset.nodes as any,
            edges: preset.edges as any,
            description: preset.description,
        });

        const updatedGraph = await agentGraphService.getGraph(params.id);
        return NextResponse.json({ graph: updatedGraph, reset: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/agent-graphs/${params.id}/reset POST] Error:`, error);
        return NextResponse.json({ error: "Failed to reset graph" }, { status: 500 });
    }
}
