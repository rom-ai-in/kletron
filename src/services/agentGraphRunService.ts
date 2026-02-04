import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { AgentGraphNodeStatus, AgentGraphRun, AgentGraphStatus, AgentGraphState } from "./agentGraphTypes";
import type { TokenUsage, TokenUsageSummary } from "./tokenUsageTypes";

const COLLECTION_NAME = "agent_graph_runs";

export class AgentGraphRunService {
    async createRun(graphId: string): Promise<string> {
        if (!ObjectId.isValid(graphId)) {
            throw new Error("Invalid graph ID format");
        }
        const db = await getDb();
        const run: AgentGraphRun = {
            graphId: new ObjectId(graphId),
            status: "PENDING",
            startedAt: new Date(),
            nodeOrder: [],
            nodeSessionIds: {},
            nodeStatuses: {},
            nodeTokenUsage: {},
            state: { nodes: {} },
        };
        const result = await db.collection(COLLECTION_NAME).insertOne(run as any);
        return result.insertedId.toString();
    }

    async getRun(runId: string): Promise<AgentGraphRun | null> {
        if (!ObjectId.isValid(runId)) return null;
        const db = await getDb();
        const run = await db
            .collection(COLLECTION_NAME)
            .findOne({ _id: new ObjectId(runId) });
        return (run as AgentGraphRun) || null;
    }

    async listRuns(graphId: string, limit = 20): Promise<AgentGraphRun[]> {
        if (!ObjectId.isValid(graphId)) return [];
        const db = await getDb();
        const runs = await db
            .collection(COLLECTION_NAME)
            .find({ graphId: new ObjectId(graphId) })
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();
        return runs as AgentGraphRun[];
    }

    async updateRunStatus(
        runId: string,
        status: AgentGraphStatus,
        updates?: Partial<AgentGraphRun>
    ): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const db = await getDb();
        const { _id: _, ...updateData } = (updates ?? {}) as any;
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(runId) },
            {
                $set: {
                    status,
                    ...updateData,
                },
            }
        );
    }

    async updateRunNodeStatus(runId: string, nodeId: string, status: AgentGraphNodeStatus): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const db = await getDb();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(runId) },
            { $set: { [`nodeStatuses.${nodeId}`]: status } }
        );
    }

    async setRunNodeSessionId(runId: string, nodeId: string, sessionId: string): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const db = await getDb();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(runId) },
            { $set: { [`nodeSessionIds.${nodeId}`]: sessionId } }
        );
    }

    async setNodeOrder(runId: string, nodeOrder: string[]): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const db = await getDb();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(runId) },
            { $set: { nodeOrder } }
        );
    }

    async updateRunState(runId: string, state: AgentGraphState): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const db = await getDb();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(runId) },
            { $set: { state } }
        );
    }

    /**
     * Update token usage for a specific node within a run.
     */
    async updateNodeTokenUsage(runId: string, nodeId: string, usage: TokenUsage): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const db = await getDb();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(runId) },
            { $set: { [`nodeTokenUsage.${nodeId}`]: usage } }
        );
    }

    /**
     * Update the run-level aggregated token usage summary.
     */
    async updateRunTokenUsage(runId: string, usage: TokenUsageSummary): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const db = await getDb();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(runId) },
            { $set: { tokenUsage: usage } }
        );
    }
}

export const agentGraphRunService = new AgentGraphRunService();
