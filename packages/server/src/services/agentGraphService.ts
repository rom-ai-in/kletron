import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { AgentGraphDefinition } from "./agentGraphTypes";
import {
    buildDriftAnalysisGraph,
    buildSimpleReactAgentGraph,
    buildCoderAgentGraph,
    buildExplorerAgentGraph,
    buildPlannerAgentGraph,
    buildBusinessAnalystGraph,
} from "./agentGraphPresets";

const COLLECTION_NAME = "agent_graphs";
const fallbackGraphs = new Map<string, AgentGraphDefinition>();
let fallbackEnabled = false;
let fallbackWarned = false;

const HIDDEN_GRAPH_NAMES = new Set<string>([
    // Legacy graph names — if they still lurk in the DB they are hidden from lists
    "Cursor-like Robust Loop (agent graph)",
    "Complete Deep Agent (agent graph)",
    "Continuous Improvement (agent graph)",
    "Diamond flow (agent graph)",
    "Presentation Generator Pro",
    "Automations (agent graph)",
]);

function warnFallback(error: unknown) {
    if (fallbackWarned) return;
    fallbackWarned = true;
    console.warn("[AgentGraph] Falling back to in-memory store:", (error as Error)?.message ?? error);
}

async function getCollectionSafe() {
    if (fallbackEnabled) return null;
    try {
        const db = await getDb();
        return db.collection(COLLECTION_NAME);
    } catch (error) {
        fallbackEnabled = true;
        warnFallback(error);
        return null;
    }
}

function ensureFallbackGraphs() {
    if (fallbackGraphs.size > 0) return;
    const now = new Date();
    const entries: Array<{ id: string; graph: Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> }> = [
        { id: "000000000000000000000002", graph: buildSimpleReactAgentGraph() },
        { id: "000000000000000000000006", graph: buildDriftAnalysisGraph() },
        { id: "000000000000000000000008", graph: buildCoderAgentGraph() },
        { id: "000000000000000000000009", graph: buildExplorerAgentGraph() },
        { id: "00000000000000000000000a", graph: buildPlannerAgentGraph() },
        { id: "00000000000000000000000c", graph: buildBusinessAnalystGraph() },
    ];

    for (const entry of entries) {
        const graph: AgentGraphDefinition = {
            ...entry.graph,
            _id: entry.id as any,
            createdAt: now,
            updatedAt: now,
        };
        fallbackGraphs.set(entry.id, graph);
    }
}

export type AgentGraphFilter = {
    search?: string;
};

export class AgentGraphService {
    async createGraph(
        input: Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt">
    ): Promise<string> {
        const collection = await getCollectionSafe();
        const now = new Date();
        const graph: AgentGraphDefinition = {
            ...input,
            createdAt: now,
            updatedAt: now,
        };

        if (!collection) {
            const id = new ObjectId().toString();
            fallbackGraphs.set(id, { ...graph, _id: id as any });
            return id;
        }

        const result = await collection.insertOne(graph as any);
        return result.insertedId.toString();
    }

    async getGraph(graphId: string): Promise<AgentGraphDefinition | null> {
        if (!ObjectId.isValid(graphId)) return null;
        const collection = await getCollectionSafe();
        if (!collection) {
            ensureFallbackGraphs();
            return fallbackGraphs.get(graphId) ?? null;
        }
        const graph = await collection.findOne({ _id: new ObjectId(graphId) });
        return (graph as AgentGraphDefinition) || null;
    }

    async listGraphs(filter?: AgentGraphFilter): Promise<AgentGraphDefinition[]> {
        const collection = await getCollectionSafe();
        if (!collection) {
            ensureFallbackGraphs();
            let graphs = Array.from(fallbackGraphs.values());
            graphs = graphs.filter((graph) => !HIDDEN_GRAPH_NAMES.has(graph.name));
            if (filter?.search) {
                const needle = filter.search.toLowerCase();
                graphs = graphs.filter(
                    (graph) =>
                        graph.name.toLowerCase().includes(needle) ||
                        (graph.description ?? "").toLowerCase().includes(needle)
                );
            }
            return graphs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        const query: any = {};
        if (filter?.search) {
            // Escape regex special chars so names with parentheses, brackets, etc. match literally
            const escaped = filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { description: { $regex: escaped, $options: "i" } },
            ];
        }
        const graphs = await collection
            .find(query)
            .sort({ updatedAt: -1 })
            .toArray();
        return (graphs as AgentGraphDefinition[]).filter(
            (graph) => !HIDDEN_GRAPH_NAMES.has(graph.name)
        );
    }

    async updateGraph(graphId: string, updates: Partial<AgentGraphDefinition>): Promise<void> {
        if (!ObjectId.isValid(graphId)) {
            throw new Error("Invalid graph ID format");
        }
        const collection = await getCollectionSafe();
        const { _id: _, ...updateData } = updates as any;
        updateData.updatedAt = new Date();
        if (!collection) {
            ensureFallbackGraphs();
            const existing = fallbackGraphs.get(graphId);
            if (!existing) return;
            fallbackGraphs.set(graphId, { ...existing, ...updateData, _id: existing._id });
            return;
        }
        await collection.updateOne(
            { _id: new ObjectId(graphId) },
            { $set: updateData, $unset: { viewport: "" } }
        );
    }

    async deleteGraph(graphId: string): Promise<void> {
        if (!ObjectId.isValid(graphId)) {
            throw new Error("Invalid graph ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            fallbackGraphs.delete(graphId);
            return;
        }
        await collection.deleteOne({ _id: new ObjectId(graphId) });
    }

    /**
     * Ensure that all default preset graphs exist in the database.
     * Safe to call multiple times — skips graphs that already exist by name.
     * Called during user registration to guarantee every new user has default graphs.
     */
    async ensureDefaultGraphs(): Promise<void> {
        const defaultPresets = [
            buildSimpleReactAgentGraph,
        ];

        for (const builder of defaultPresets) {
            const preset = builder();
            const existing = await this.listGraphs({ search: preset.name });
            const match = existing.find((g) => g.name === preset.name);
            if (!match) {
                await this.createGraph(preset);
            }
        }
    }
}

export const agentGraphService = new AgentGraphService();

