import { ObjectId } from "mongodb";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { normalizeResearchDepth, type ResearchDepthId } from "@kletron/shared/researchDepth";
import { getDb } from "../lib/db";
import type { AgentGraphNodeStatus, AgentGraphRun, AgentGraphStatus, AgentGraphState } from "./agentGraphTypes";
import type { TokenUsage, TokenUsageSummary } from "./tokenUsageTypes";
import { deleteThreadCheckpoints } from "./checkpointService";

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

export type CreateRunOptions = {
    /** Links this thread to its automation config (set on automation main + sub-runs). */
    automationId?: string;
    /** Identifies this run as a hidden sub-stage of a main automation thread. */
    parentRunId?: string;
    /** Stage index: 0 for the main automation thread, i for sub-stages. */
    stageIndex?: number;
    /** Initial title for the run/session (e.g. automation name + ISO date). */
    title?: string;
    /** Per-thread tool approval mode (interactive agent sessions). */
    threadApprovalMode?: ThreadApprovalMode;
    /** Code vs Work — scopes tool allowlists for interactive sessions. */
    workMode?: "code" | "work";
    /** User id for per-tenant approval policy (interactive sessions). */
    createdByUserId?: string;
    /** Agent research depth (default exhaustive). */
    researchDepth?: ResearchDepthId | string;
};

export class AgentGraphRunService {
    async createRun(
        graphId: string,
        workspaceId?: string,
        source?: string,
        options?: CreateRunOptions,
    ): Promise<string> {
        if (!ObjectId.isValid(graphId)) {
            throw new Error("Invalid graph ID format");
        }
        const collection = await getCollectionSafe();
        const automationId = options?.automationId && ObjectId.isValid(options.automationId)
            ? new ObjectId(options.automationId)
            : undefined;
        const parentRunId = options?.parentRunId && ObjectId.isValid(options.parentRunId)
            ? new ObjectId(options.parentRunId)
            : undefined;
        const run: AgentGraphRun = {
            graphId: new ObjectId(graphId),
            workspaceId: workspaceId && ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : undefined,
            ...(source ? { source } : {}),
            ...(automationId ? { automationId } : {}),
            ...(parentRunId ? { parentRunId } : {}),
            ...(typeof options?.stageIndex === "number" ? { stageIndex: options.stageIndex } : {}),
            ...(options?.title ? { title: options.title } : {}),
            ...(options?.threadApprovalMode && options.threadApprovalMode !== "inherit"
                ? { threadApprovalMode: options.threadApprovalMode }
                : {}),
            ...(options?.workMode ? { workMode: options.workMode } : {}),
            ...(options?.createdByUserId ? { createdByUserId: options.createdByUserId } : {}),
            researchDepth: normalizeResearchDepth(options?.researchDepth),
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

    /** Lightweight read for hot path (tool approval per call). */
    async getRunThreadApprovalMode(runId: string): Promise<ThreadApprovalMode | undefined> {
        if (!ObjectId.isValid(runId)) return undefined;
        const collection = await getCollectionSafe();
        if (!collection) {
            return getFallbackRun(runId)?.threadApprovalMode;
        }
        try {
            const doc = await collection.findOne(
                { _id: new ObjectId(runId) },
                { projection: { threadApprovalMode: 1 } }
            );
            return doc?.threadApprovalMode as ThreadApprovalMode | undefined;
        } catch {
            return getFallbackRun(runId)?.threadApprovalMode;
        }
    }

    /** Work mode for tool policy (defaults to `code` when unset). */
    async getRunWorkMode(runId: string): Promise<"code" | "work"> {
        if (!ObjectId.isValid(runId)) return "code";
        const collection = await getCollectionSafe();
        const fromDoc = (r: AgentGraphRun | null | undefined) =>
            r?.workMode === "work" ? "work" : "code";
        if (!collection) {
            return fromDoc(getFallbackRun(runId));
        }
        try {
            const doc = await collection.findOne({ _id: new ObjectId(runId) }, { projection: { workMode: 1 } });
            return fromDoc(doc as AgentGraphRun | null);
        } catch {
            return fromDoc(getFallbackRun(runId));
        }
    }

    /** Research depth for prompts and LangGraph budget (defaults to exhaustive). */
    async getRunResearchDepth(runId: string): Promise<ResearchDepthId> {
        if (!ObjectId.isValid(runId)) return "exhaustive";
        const collection = await getCollectionSafe();
        const fromDoc = (r: AgentGraphRun | null | undefined) => normalizeResearchDepth(r?.researchDepth);
        if (!collection) {
            return fromDoc(getFallbackRun(runId));
        }
        try {
            const doc = await collection.findOne({ _id: new ObjectId(runId) }, { projection: { researchDepth: 1 } });
            return fromDoc(doc as AgentGraphRun | null);
        } catch {
            return fromDoc(getFallbackRun(runId));
        }
    }

    async patchRun(
        runId: string,
        partial: Partial<Pick<AgentGraphRun, "threadApprovalMode" | "title" | "workMode" | "researchDepth">>,
    ): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }
        const keys = Object.keys(partial).filter((k) => partial[k as keyof typeof partial] !== undefined);
        if (keys.length === 0) return;
        const collection = await getCollectionSafe();
        const $set: Record<string, unknown> = {};
        for (const k of keys) {
            $set[k] = partial[k as keyof typeof partial];
        }
        if (!collection) {
            const existing = fallbackRuns.get(runId);
            if (!existing) return;
            fallbackRuns.set(runId, { ...existing, ...partial });
            return;
        }
        try {
            await collection.updateOne({ _id: new ObjectId(runId) }, { $set });
        } catch (error) {
            enableFallback(error);
            const seeded = await ensureFallbackRun(runId, collection);
            if (!seeded) return;
            fallbackRuns.set(runId, { ...seeded, ...partial });
        }
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
        opts?: {
            includeArchived?: boolean;
            limit?: number;
            graphId?: string;
            excludeSource?: string;
            /** When set, only runs whose stored mode matches (legacy runs without field count as `code`). */
            workMode?: "code" | "work";
        }
    ): Promise<AgentGraphRun[]> {
        const limit = opts?.limit ?? 50;
        const collection = await getCollectionSafe();
        if (!collection) {
            const wsObj = workspaceId && ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : undefined;
            let runs = Array.from(fallbackRuns.values()).filter((run) => {
                if (wsObj && run.workspaceId?.toString() !== wsObj.toString()) return false;
                if (!opts?.includeArchived && run.archived) return false;
                if (opts?.graphId && ObjectId.isValid(opts.graphId) && run.graphId?.toString() !== opts.graphId) return false;
                if (opts?.excludeSource && run.source === opts.excludeSource) return false;
                if (opts?.workMode === "work" && run.workMode !== "work") return false;
                if (opts?.workMode === "code" && run.workMode === "work") return false;
                // Hide automation sub-stage runs from the sidebar listing.
                if (run.parentRunId) return false;
                return true;
            });
            runs = runs.sort((a, b) => (b.startedAt?.getTime?.() ?? 0) - (a.startedAt?.getTime?.() ?? 0));
            return runs.slice(0, limit);
        }
        const filter: Record<string, unknown> = {
            // Hide automation sub-stage runs from the sidebar listing.
            parentRunId: { $exists: false },
        };
        if (workspaceId && ObjectId.isValid(workspaceId)) {
            filter.workspaceId = new ObjectId(workspaceId);
        }
        if (!opts?.includeArchived) {
            filter.archived = { $ne: true };
        }
        if (opts?.graphId && ObjectId.isValid(opts.graphId)) {
            filter.graphId = new ObjectId(opts.graphId);
        }
        if (opts?.excludeSource) {
            filter.source = { $ne: opts.excludeSource };
        }
        if (opts?.workMode === "work") {
            filter.workMode = "work";
        } else if (opts?.workMode === "code") {
            filter.$or = [
                { workMode: "code" },
                { workMode: { $exists: false } },
                { workMode: null },
            ];
        }
        const runs = await collection
            .find(filter)
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();
        return runs as AgentGraphRun[];
    }

    /**
     * List sessions across multiple workspace IDs (including orphans) in a single query.
     * Uses `$or` to avoid N+1 queries.
     */
    async listSessionsForWorkspaces(
        workspaceIds: string[],
        opts?: { includeArchived?: boolean; limit?: number; graphId?: string }
    ): Promise<AgentGraphRun[]> {
        const limit = opts?.limit ?? 50;
        const collection = await getCollectionSafe();

        // Build valid ObjectIds
        const validWsOids = workspaceIds
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));

        if (!collection) {
            // Fallback: in-memory filter
            const wsSet = new Set(validWsOids.map((o) => o.toString()));
            let runs = Array.from(fallbackRuns.values()).filter((run) => {
                // Include if workspace matches OR if orphan (no workspaceId)
                const wsStr = run.workspaceId?.toString();
                if (wsStr && !wsSet.has(wsStr)) return false;
                if (!opts?.includeArchived && run.archived) return false;
                if (opts?.graphId && ObjectId.isValid(opts.graphId) && run.graphId?.toString() !== opts.graphId) return false;
                // Hide automation sub-stage runs from the sidebar listing.
                if (run.parentRunId) return false;
                return true;
            });
            runs = runs.sort((a, b) => (b.startedAt?.getTime?.() ?? 0) - (a.startedAt?.getTime?.() ?? 0));
            return runs.slice(0, limit);
        }

        // Single DB query: sessions in any of the workspaces OR orphans (no workspaceId)
        const filter: Record<string, unknown> = {
            // Hide automation sub-stage runs from the sidebar listing.
            parentRunId: { $exists: false },
            $or: [
                ...(validWsOids.length > 0 ? [{ workspaceId: { $in: validWsOids } }] : []),
                { workspaceId: { $exists: false } },
                { workspaceId: null },
            ],
        };
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
     * Also cleans up any LangGraph checkpoints associated with the run.
     */
    async deleteRun(runId: string): Promise<void> {
        if (!ObjectId.isValid(runId)) {
            throw new Error("Invalid run ID format");
        }

        // Clean up LangGraph checkpoints for all possible thread IDs.
        // Thread IDs follow the pattern `{runId}:{nodeId}` — we attempt
        // to delete the run-level thread; per-node threads are cleaned up
        // by the checkpoint service if it supports prefix-based deletion.
        deleteThreadCheckpoints(runId).catch(() => {});

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
    /**
     * List automation sub-runs (hidden child runs) for a given main thread.
     * Used by the agent UI to expose "Open detailed stage trace" links.
     */
    async listSubRuns(parentRunId: string): Promise<AgentGraphRun[]> {
        if (!ObjectId.isValid(parentRunId)) return [];
        const collection = await getCollectionSafe();
        if (!collection) {
            const parentObj = new ObjectId(parentRunId);
            return Array.from(fallbackRuns.values())
                .filter((run) => run.parentRunId?.toString() === parentObj.toString())
                .sort((a, b) => (a.stageIndex ?? 0) - (b.stageIndex ?? 0));
        }
        const runs = await collection
            .find({ parentRunId: new ObjectId(parentRunId) })
            .sort({ stageIndex: 1 })
            .toArray();
        return runs as AgentGraphRun[];
    }
}

export const agentGraphRunService = new AgentGraphRunService();
