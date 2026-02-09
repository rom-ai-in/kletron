import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { AgentGraphNodeStatus, AgentGraphRun, AgentGraphStatus, AgentGraphState } from "./agentGraphTypes";
import type { TokenUsage, TokenUsageSummary } from "./tokenUsageTypes";

const COLLECTION_NAME = "agent_graph_runs";
const fallbackRuns = new Map<string, AgentGraphRun>();
let fallbackEnabled = false;
let fallbackWarned = false;

function warnFallback(error: unknown) {
    if (fallbackWarned) return;
    fallbackWarned = true;
    console.warn("[AgentGraphRun] Falling back to in-memory store:", (error as Error)?.message ?? error);
}

function enableFallback(error: unknown) {
    fallbackEnabled = true;
    warnFallback(error);
}

async function getCollectionSafe() {
    if (fallbackEnabled) return null;
    try {
        const db = await getDb();
        return db.collection(COLLECTION_NAME);
    } catch (error) {
        enableFallback(error);
        return null;
    }
}

function getFallbackRun(runId: string) {
    return fallbackRuns.get(runId) ?? null;
}

async function ensureFallbackRun(runId: string, collection: any) {
    const existing = fallbackRuns.get(runId);
    if (existing) return existing;
    if (!collection) return null;
    try {
        const doc = await collection.findOne({ _id: new ObjectId(runId) });
        if (doc) {
            fallbackRuns.set(runId, doc as AgentGraphRun);
            return doc as AgentGraphRun;
        }
    } catch {
        return null;
    }
    return null;
}

export class AgentGraphRunService {
    async createRun(graphId: string, workspaceId?: string): Promise<string> {
        if (!ObjectId.isValid(graphId)) {
            throw new Error("Invalid graph ID format");
        }
        const collection = await getCollectionSafe();
        const run: AgentGraphRun = {
            graphId: new ObjectId(graphId),
            workspaceId: workspaceId && ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : undefined,
            status: "PENDING",
            startedAt: new Date(),
            nodeOrder: [],
            nodeSessionIds: {},
            nodeStatuses: {},
            nodeTokenUsage: {},
            state: { nodes: {} },
        };
        if (!collection) {
            const id = new ObjectId().toString();
            fallbackRuns.set(id, { ...run, _id: new ObjectId(id) });
            return id;
        }
        try {
            const result = await collection.insertOne(run as any);
            return result.insertedId.toString();
        } catch (error) {
            enableFallback(error);
            const id = new ObjectId().toString();
            fallbackRuns.set(id, { ...run, _id: new ObjectId(id) });
            return id;
        }
    }

    async getRun(runId: string): Promise<AgentGraphRun | null> {
        if (!ObjectId.isValid(runId)) return null;
        const collection = await getCollectionSafe();
        if (!collection) {
            return getFallbackRun(runId);
        }
        const run = await collection.findOne({ _id: new ObjectId(runId) });
        return (run as AgentGraphRun) || null;
    }

    async listRuns(graphId: string, limit = 20, workspaceId?: string): Promise<AgentGraphRun[]> {
        if (!ObjectId.isValid(graphId)) return [];
        const collection = await getCollectionSafe();
        if (!collection) {
            const graphIdObj = new ObjectId(graphId);
            const workspaceObj = workspaceId && ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : undefined;
            let runs = Array.from(fallbackRuns.values()).filter(
                (run) =>
                    run.graphId?.toString() === graphIdObj.toString() &&
                    (!workspaceObj || run.workspaceId?.toString() === workspaceObj.toString())
            );
            runs = runs.sort((a, b) => (b.startedAt?.getTime?.() ?? 0) - (a.startedAt?.getTime?.() ?? 0));
            return runs.slice(0, limit);
        }
        const filter: Record<string, unknown> = { graphId: new ObjectId(graphId) };
        if (workspaceId && ObjectId.isValid(workspaceId)) {
            filter.workspaceId = new ObjectId(workspaceId);
        }
        const runs = await collection
            .find(filter)
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
        const collection = await getCollectionSafe();
        const { _id: _, ...updateData } = (updates ?? {}) as any;
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, {
                ...existing,
                status,
                ...updateData,
            });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                {
                    $set: {
                        status,
                        ...updateData,
                    },
                }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, {
                ...seeded,
                status,
                ...updateData,
            });
        }
    }

    async updateRunNodeStatus(runId: string, nodeId: string, status: AgentGraphNodeStatus): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, {
                ...existing,
                nodeStatuses: { ...(existing.nodeStatuses ?? {}), [nodeId]: status },
            });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { [`nodeStatuses.${nodeId}`]: status } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, {
                ...seeded,
                nodeStatuses: { ...(seeded.nodeStatuses ?? {}), [nodeId]: status },
            });
        }
    }

    async setRunNodeSessionId(runId: string, nodeId: string, sessionId: string): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, {
                ...existing,
                nodeSessionIds: { ...(existing.nodeSessionIds ?? {}), [nodeId]: sessionId },
            });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { [`nodeSessionIds.${nodeId}`]: sessionId } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, {
                ...seeded,
                nodeSessionIds: { ...(seeded.nodeSessionIds ?? {}), [nodeId]: sessionId },
            });
        }
    }

    async setNodeOrder(runId: string, nodeOrder: string[]): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, { ...existing, nodeOrder });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { nodeOrder } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, { ...seeded, nodeOrder });
        }
    }

    async updateRunState(runId: string, state: AgentGraphState): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, { ...existing, state });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { state } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, { ...seeded, state });
        }
    }

    /**
     * Update token usage for a specific node within a run.
     */
    async updateNodeTokenUsage(runId: string, nodeId: string, usage: TokenUsage): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, {
                ...existing,
                nodeTokenUsage: { ...(existing.nodeTokenUsage ?? {}), [nodeId]: usage },
            });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { [`nodeTokenUsage.${nodeId}`]: usage } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, {
                ...seeded,
                nodeTokenUsage: { ...(seeded.nodeTokenUsage ?? {}), [nodeId]: usage },
            });
        }
    }

    /**
     * Update the run-level aggregated token usage summary.
     */
    async updateRunTokenUsage(runId: string, usage: TokenUsageSummary): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, { ...existing, tokenUsage: usage });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { tokenUsage: usage } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, { ...seeded, tokenUsage: usage });
        }
    }

    /**
     * List runs as sessions, sorted by most recent first.
     * Supports optional workspace filtering and archived toggle.
     */
    async listSessions(
        workspaceId?: string,
        opts?: { includeArchived?: boolean; limit?: number; graphId?: string }
    ): Promise<AgentGraphRun[]> {
        const limit = opts?.limit ?? 50;
        const collection = await getCollectionSafe();
        if (!collection) {
            const wsObj = workspaceId && ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : undefined;
            let runs = Array.from(fallbackRuns.values()).filter((run) => {
                if (wsObj && run.workspaceId?.toString() !== wsObj.toString()) return false;
                if (!opts?.includeArchived && run.archived) return false;
                if (opts?.graphId && ObjectId.isValid(opts.graphId) && run.graphId?.toString() !== opts.graphId) return false;
                return true;
            });
            runs = runs.sort((a, b) => (b.startedAt?.getTime?.() ?? 0) - (a.startedAt?.getTime?.() ?? 0));
            return runs.slice(0, limit);
        }
        const filter: Record<string, unknown> = {};
        if (workspaceId && ObjectId.isValid(workspaceId)) {
            filter.workspaceId = new ObjectId(workspaceId);
        }
        if (!opts?.includeArchived) {
            filter.archived = { $ne: true };
        }
        if (opts?.graphId && ObjectId.isValid(opts.graphId)) {
            filter.graphId = new ObjectId(opts.graphId);
        }
        const runs = await collection
            .find(filter)
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();
        return runs as AgentGraphRun[];
    }

    /**
     * Update the title of a run/session.
     */
    async updateTitle(runId: string, title: string): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, { ...existing, title });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { title } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, { ...seeded, title });
        }
    }

    /**
     * Archive a run/session.
     */
    async archiveRun(runId: string): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, { ...existing, archived: true });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $set: { archived: true } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, { ...seeded, archived: true });
        }
    }

    /**
     * Delete a run/session permanently.
     */
    async deleteRun(runId: string): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            fallbackRuns.delete(runId);
            return;
        }
        try {
            await collection.deleteOne({ _id: new ObjectId(runId) });
        } catch (error) {
            enableFallback(error);
            fallbackRuns.delete(runId);
        }
    }

    /**
     * Increment the conversationTurns counter for a run.
     */
    async incrementConversationTurns(runId: string): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const collection = await getCollectionSafe();
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, {
                ...existing,
                conversationTurns: (existing.conversationTurns ?? 0) + 1,
            });
            return;
        }
        try {
            await collection.updateOne(
                { _id: new ObjectId(runId) },
                { $inc: { conversationTurns: 1 } }
            );
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, {
                ...seeded,
                conversationTurns: (seeded.conversationTurns ?? 0) + 1,
            });
        }
    }
}

export const agentGraphRunService = new AgentGraphRunService();
