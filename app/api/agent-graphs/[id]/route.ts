export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { agentGraphService } from "@/src/services/agentGraphService";
import { topoSortAgentGraph } from "@/src/services/agentGraphTopo";
import { nodeOutputSchemaRegistry } from "@/src/shared/nodeOutputSchemas";
import { allMcpTools } from "@/src/tools/mcpTools";

const mcpToolNames = new Set<string>(allMcpTools.map((t: any) => String((t as any)?.name ?? "")));
const schemaIds = new Set<string>(Object.keys(nodeOutputSchemaRegistry));

const GraphSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    nodes: z.array(
        z.object({
            id: z.string().min(1),
            label: z.string().min(1).max(200),
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
            }),
        })
    ),
    edges: z.array(
        z.object({
            id: z.string().min(1),
            source: z.string().min(1),
            target: z.string().min(1),
        })
    ),
});

const UpdateGraphSchema = z.object({
    graph: GraphSchema,
});

function validateGraphSemantics(graph: z.infer<typeof GraphSchema>) {
    const errors: string[] = [];

    const ids = graph.nodes.map((n) => n.id);
    const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (dupes.length) errors.push(`Duplicate node IDs: ${[...new Set(dupes)].join(", ")}`);

    for (const node of graph.nodes) {
        if (!schemaIds.has(node.output.schemaId)) {
            errors.push(`Node ${node.id} has unknown output.schemaId: ${node.output.schemaId}`);
        }
    }

    for (const node of graph.nodes) {
        for (const toolName of node.react.toolNames ?? []) {
            if (!mcpToolNames.has(toolName)) {
                errors.push(`Node ${node.id} references unknown tool: ${toolName}`);
            }
        }
    }

    try {
        topoSortAgentGraph(graph.nodes as any, graph.edges as any);
    } catch (e: any) {
        if (Array.isArray(e?.details) && e.details.length) {
            errors.push(...e.details);
        } else {
            errors.push(e?.message ?? "Invalid graph (failed DAG validation)");
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * GET /api/agent-graphs/[id]
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const graph = await agentGraphService.getGraph(params.id);
        if (!graph) {
            return NextResponse.json({ error: "Graph not found" }, { status: 404 });
        }
        return NextResponse.json({ graph }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/agent-graphs/${params.id} GET] Error:`, error);
        return NextResponse.json({ error: "Failed to get graph" }, { status: 500 });
    }
}

/**
 * PUT /api/agent-graphs/[id]
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const validation = UpdateGraphSchema.safeParse(body);
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

        await agentGraphService.updateGraph(params.id, {
            name: graph.name,
            description: graph.description,
            nodes: graph.nodes as any,
            edges: graph.edges as any,
        });

        return NextResponse.json({ updated: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/agent-graphs/${params.id} PUT] Error:`, error);
        return NextResponse.json({ error: "Failed to update graph" }, { status: 500 });
    }
}

/**
 * DELETE /api/agent-graphs/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        await agentGraphService.deleteGraph(params.id);
        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/agent-graphs/${params.id} DELETE] Error:`, error);
        return NextResponse.json({ error: "Failed to delete graph" }, { status: 500 });
    }
}

