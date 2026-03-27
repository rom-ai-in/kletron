export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { topoSortAgentGraph } from "@kletron/server/services/agentGraphTopo";
import { validateCondition } from "@kletron/server/services/agentGraphConditions";
import { resolveExecutionMode } from "@kletron/server/services/agentGraphRuntime";
import { nodeOutputSchemaRegistry } from "@kletron/shared/nodeOutputSchemas";
import { allMcpTools } from "@kletron/agent-core/tools/mcpTools";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

// Allowed tool names for agent graph nodes.
// Includes all MCP-backed tools plus special in-process tools like `write_todos`
// that are provided by the agent graph executor rather than the MCP server.
const mcpToolNames = new Set<string>([
    ...allMcpTools.map((t: any) => String((t as any)?.name ?? "")),
    "write_todos",
]);
const schemaIds = new Set<string>(Object.keys(nodeOutputSchemaRegistry));

const GraphSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    execution: z
        .object({
            mode: z.enum(["dag", "state_machine"]).optional(),
            entryNodeId: z.string().min(1).optional(),
            maxIterations: z.number().int().positive().optional(),
            maxNodeRuns: z.number().int().positive().optional(),
        })
        .optional(),
    stateDefaults: z.record(z.any()).optional(),
    nodes: z.array(
        z.object({
            id: z.string().min(1),
            label: z.string().min(1).max(200),
            kind: z.enum(["react", "router"]).optional(),
            react: z.object({
                systemPrompt: z.string(),
                userPromptTemplate: z.string(),
                toolNames: z.array(z.string()).default([]),
                llmSelection: z
                    .object({
                        provider: z.enum(["azure", "lmstudio"]),
                        model: z.string().optional(),
                    })
                    .optional(),
                maxToolCalls: z.number().int().positive().optional(),
            }),
            output: z.object({
                schemaId: z.string().min(1),
                statePath: z.string().min(1).optional(),
                stateMerge: z.boolean().optional(),
            }),
        })
    ),
    edges: z.array(
        z.object({
            id: z.string().min(1),
            source: z.string().min(1),
            target: z.string().min(1),
            condition: z.string().max(500).optional(),
        })
    ),
});

const CreateGraphSchema = z.object({
    graph: GraphSchema,
});

function validateGraphSemantics(graph: z.infer<typeof GraphSchema>) {
    const errors: string[] = [];

    // Unique node IDs
    const ids = graph.nodes.map((n) => n.id);
    const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (dupes.length) errors.push(`Duplicate node IDs: ${[...new Set(dupes)].join(", ")}`);

    // schemaId
    for (const node of graph.nodes) {
        if (!schemaIds.has(node.output.schemaId)) {
            errors.push(`Node ${node.id} has unknown output.schemaId: ${node.output.schemaId}`);
        }
    }

    // Tool allowlist
    for (const node of graph.nodes) {
        for (const toolName of node.react.toolNames ?? []) {
            if (!mcpToolNames.has(toolName)) {
                errors.push(`Node ${node.id} references unknown tool: ${toolName}`);
            }
        }
    }

    // Edge references + condition validation
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    for (const edge of graph.edges) {
        if (!nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} references unknown source node: ${edge.source}`);
        if (!nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} references unknown target node: ${edge.target}`);
        if (edge.condition) {
            const check = validateCondition(edge.condition);
            if (!check.valid) {
                errors.push(`Edge ${edge.id} has invalid condition: ${check.error ?? "invalid condition"}`);
            }
        }
    }

    // Execution validation
    const mode = resolveExecutionMode(graph as any);
    if (graph.execution?.entryNodeId && !nodeIds.has(graph.execution.entryNodeId)) {
        errors.push(`Execution entryNodeId not found: ${graph.execution.entryNodeId}`);
    }

    if (mode === "dag") {
        try {
            topoSortAgentGraph(graph.nodes as any, graph.edges as any);
        } catch (e: any) {
            if (Array.isArray(e?.details) && e.details.length) {
                errors.push(...e.details);
            } else {
                errors.push(e?.message ?? "Invalid graph (failed DAG validation)");
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * GET /api/agent-graphs
 * List all agent graphs (optional search)
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
          return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const searchParams = req.nextUrl.searchParams;
        const search = searchParams.get("search") || undefined;
        const graphs = await agentGraphService.listGraphs({ search });
        return NextResponse.json({ graphs }, { status: 200 });
    } catch (error) {
        console.error("[API /api/agent-graphs GET] Error (returning empty list):", error);
        // Fallback to empty list so UI doesn't break if DB is unreachable
        return NextResponse.json({ graphs: [] }, { status: 200 });
    }
}

/**
 * POST /api/agent-graphs
 * Create a new agent graph
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
          return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const body = await req.json();
        const validation = CreateGraphSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.errors },
                { status: 400 }
            );
        }

        const { graph } = validation.data;
        const semantic = validateGraphSemantics(graph);
        if (!semantic.valid) {
            return NextResponse.json(
                { error: "Invalid graph configuration", details: semantic.errors },
                { status: 400 }
            );
        }

        const graphId = await agentGraphService.createGraph({
            name: graph.name,
            description: graph.description,
            nodes: graph.nodes as any,
            edges: graph.edges as any,
            execution: graph.execution as any,
            stateDefaults: graph.stateDefaults as any,
        });

        return NextResponse.json({ graphId }, { status: 201 });
    } catch (error) {
        console.error("[API /api/agent-graphs POST] Error:", error);
        return NextResponse.json({ error: "Failed to create graph" }, { status: 500 });
    }
}
