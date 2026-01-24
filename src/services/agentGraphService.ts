import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { AgentGraphDefinition } from "./agentGraphTypes";

const COLLECTION_NAME = "agent_graphs";

export type AgentGraphFilter = {
    search?: string;
};

export class AgentGraphService {
    async createGraph(
        input: Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt">
    ): Promise<string> {
        const db = await getDb();
        const now = new Date();
        const graph: AgentGraphDefinition = {
            ...input,
            createdAt: now,
            updatedAt: now,
        };
        const result = await db.collection(COLLECTION_NAME).insertOne(graph as any);
        return result.insertedId.toString();
    }

    async getGraph(graphId: string): Promise<AgentGraphDefinition | null> {
        if (!ObjectId.isValid(graphId)) return null;
        const db = await getDb();
        const graph = await db
            .collection(COLLECTION_NAME)
            .findOne({ _id: new ObjectId(graphId) });
        return (graph as AgentGraphDefinition) || null;
    }

    async listGraphs(filter?: AgentGraphFilter): Promise<AgentGraphDefinition[]> {
        const db = await getDb();
        const query: any = {};
        if (filter?.search) {
            query.$or = [
                { name: { $regex: filter.search, $options: "i" } },
                { description: { $regex: filter.search, $options: "i" } },
            ];
        }
        const graphs = await db
            .collection(COLLECTION_NAME)
            .find(query)
            .sort({ updatedAt: -1 })
            .toArray();
        return graphs as AgentGraphDefinition[];
    }

    async updateGraph(graphId: string, updates: Partial<AgentGraphDefinition>): Promise<void> {
        if (!ObjectId.isValid(graphId)) {
            throw new Error("Invalid graph ID format");
        }
        const db = await getDb();
        const { _id: _, ...updateData } = updates as any;
        updateData.updatedAt = new Date();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(graphId) },
            { $set: updateData, $unset: { viewport: "" } }
        );
    }

    async deleteGraph(graphId: string): Promise<void> {
        if (!ObjectId.isValid(graphId)) {
            throw new Error("Invalid graph ID format");
        }
        const db = await getDb();
        await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(graphId) });
    }
}

export const agentGraphService = new AgentGraphService();

