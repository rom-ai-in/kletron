import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { AgentGraphDefinition } from "./agentGraphTypes";
import {
    buildCursorLikeRobustGraph,
    buildDiamondFlowAgentGraph,
    buildCompleteDeepAgentGraph,
    buildDriftAnalysisGraph,
    buildCampaignsGraph,
    buildPresentationGeneratorProGraph,
    buildSimpleReactAgentGraph
} from "./agentGraphPresets";

const COLLECTION_NAME = "agent_graphs";
const fallbackGraphs = new Map<string, AgentGraphDefinition>();
let fallbackEnabled = false;
let fallbackWarned = false;

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
        { id: "000000000000000000000001", graph: buildCursorLikeRobustGraph() },
        { id: "000000000000000000000002", graph: buildSimpleReactAgentGraph() },
        { id: "000000000000000000000003", graph: buildDiamondFlowAgentGraph() },
        { id: "000000000000000000000004", graph: buildPresentationGeneratorProGraph() },
        { id: "000000000000000000000005", graph: buildCompleteDeepAgentGraph() },
        { id: "000000000000000000000006", graph: buildDriftAnalysisGraph() },
        { id: "000000000000000000000007", graph: buildCampaignsGraph() },
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
            query.$or = [
                { name: { $regex: filter.search, $options: "i" } },
                { description: { $regex: filter.search, $options: "i" } },
            ];
        }
        const graphs = await collection
            .find(query)
            .sort({ updatedAt: -1 })
            .toArray();
        return graphs as AgentGraphDefinition[];
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
}

export const agentGraphService = new AgentGraphService();
