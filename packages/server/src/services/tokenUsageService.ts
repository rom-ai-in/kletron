import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import {
    type TokenUsage,
    type TokenUsageRecord,
    type TokenUsageSummary,
    type TokenUsageFilter,
    createEmptyTokenUsage,
    createEmptyTokenUsageSummary,
    accumulateUsage,
} from "./tokenUsageTypes";

const COLLECTION_NAME = "token_usage_logs";
let dbUnavailable = false;
let dbWarned = false;

function warnDbUnavailable(error: unknown) {
    if (dbWarned) return;
    dbWarned = true;
    console.warn("[TokenUsage] MongoDB unavailable, tracking in-memory only:", (error as Error)?.message ?? error);
}

/**
 * Service for tracking, accumulating, and persisting LLM token usage.
 * 
 * Supports:
 * - Per-call logging to MongoDB
 * - In-memory accumulation during run execution
 * - Aggregated queries by run, campaign, time period
 */
export class TokenUsageService {
    /**
     * In-memory accumulator for active runs.
     * Key: runId, Value: accumulated summary
     */
    private runAccumulators: Map<string, TokenUsageSummary> = new Map();

    /**
     * Per-node accumulator within a run.
     * Key: runId, Value: Map<nodeId, TokenUsage>
     */
    private nodeAccumulators: Map<string, Map<string, TokenUsage>> = new Map();

    /**
     * Start tracking token usage for a run.
     * Initializes in-memory accumulators.
     */
    startRunTracking(runId: string): void {
        this.runAccumulators.set(runId, createEmptyTokenUsageSummary());
        this.nodeAccumulators.set(runId, new Map());
    }

    /**
     * Log a single LLM call's token usage.
     * Persists to MongoDB and updates in-memory accumulators.
     */
    async logUsage(record: Omit<TokenUsageRecord, "_id">): Promise<void> {
        if (!dbUnavailable) {
            try {
                const db = await getDb();
                await db.collection(COLLECTION_NAME).insertOne({
                    ...record,
                    timestamp: record.timestamp ?? new Date(),
                });
            } catch (error) {
                dbUnavailable = true;
                warnDbUnavailable(error);
            }
        }

        // Update in-memory accumulators if this is part of an active run
        if (record.runId) {
            const runIdStr = record.runId.toString();
            const runSummary = this.runAccumulators.get(runIdStr);
            if (runSummary) {
                accumulateUsage(runSummary, record.usage, record.provider, record.model);
            }

            // Update node accumulator if nodeId is provided
            if (record.nodeId) {
                const nodeMap = this.nodeAccumulators.get(runIdStr);
                if (nodeMap) {
                    const existing = nodeMap.get(record.nodeId) ?? createEmptyTokenUsage();
                    nodeMap.set(record.nodeId, {
                        inputTokens: existing.inputTokens + record.usage.inputTokens,
                        outputTokens: existing.outputTokens + record.usage.outputTokens,
                        totalTokens: existing.totalTokens + record.usage.totalTokens,
                    });
                }
            }
        }
    }

    /**
     * Get the current accumulated usage for a node during active execution.
     */
    getNodeUsage(runId: string, nodeId: string): TokenUsage {
        const nodeMap = this.nodeAccumulators.get(runId);
        return nodeMap?.get(nodeId) ?? createEmptyTokenUsage();
    }

    /**
     * Get the current accumulated summary for a run during active execution.
     */
    getRunAccumulatedUsage(runId: string): TokenUsageSummary {
        return this.runAccumulators.get(runId) ?? createEmptyTokenUsageSummary();
    }

    /**
     * Finalize tracking for a run.
     * Returns the final summary and cleans up in-memory state.
     */
    finalizeRunTracking(runId: string): {
        summary: TokenUsageSummary;
        nodeUsage: Record<string, TokenUsage>;
    } {
        const summary = this.runAccumulators.get(runId) ?? createEmptyTokenUsageSummary();
        const nodeMap = this.nodeAccumulators.get(runId);
        const nodeUsage: Record<string, TokenUsage> = {};

        if (nodeMap) {
            for (const [nodeId, usage] of nodeMap.entries()) {
                nodeUsage[nodeId] = usage;
            }
        }

        // Clean up in-memory state
        this.runAccumulators.delete(runId);
        this.nodeAccumulators.delete(runId);

        return { summary, nodeUsage };
    }

    /**
     * Query aggregated token usage for a specific run from the database.
     */
    async getRunUsage(runId: string, workspaceId?: string): Promise<TokenUsageSummary> {
        if (!ObjectId.isValid(runId)) {
            return createEmptyTokenUsageSummary();
        }
        if (dbUnavailable) {
            return createEmptyTokenUsageSummary();
        }

        try {
            const db = await getDb();
            const query: Record<string, unknown> = { runId: new ObjectId(runId) };
            if (workspaceId && ObjectId.isValid(workspaceId)) {
                query.workspaceId = new ObjectId(workspaceId);
            }
            const logs = await db
                .collection(COLLECTION_NAME)
                .find(query)
                .toArray();

            const summary = createEmptyTokenUsageSummary();
            for (const log of logs) {
                const record = log as unknown as TokenUsageRecord;
                accumulateUsage(summary, record.usage, record.provider, record.model);
            }

            return summary;
        } catch (error) {
            dbUnavailable = true;
            warnDbUnavailable(error);
            return createEmptyTokenUsageSummary();
        }
    }

    /**
     * Query aggregated token usage for a campaign/chain from the database.
     */
    async getCampaignUsage(chainId: string, workspaceId?: string): Promise<TokenUsageSummary> {
        if (!ObjectId.isValid(chainId)) {
            return createEmptyTokenUsageSummary();
        }
        if (dbUnavailable) {
            return createEmptyTokenUsageSummary();
        }

        try {
            const db = await getDb();
            const query: Record<string, unknown> = { chainId: new ObjectId(chainId) };
            if (workspaceId && ObjectId.isValid(workspaceId)) {
                query.workspaceId = new ObjectId(workspaceId);
            }
            const logs = await db
                .collection(COLLECTION_NAME)
                .find(query)
                .toArray();

            const summary = createEmptyTokenUsageSummary();
            for (const log of logs) {
                const record = log as unknown as TokenUsageRecord;
                accumulateUsage(summary, record.usage, record.provider, record.model);
            }

            return summary;
        } catch (error) {
            dbUnavailable = true;
            warnDbUnavailable(error);
            return createEmptyTokenUsageSummary();
        }
    }

    /**
     * Query aggregated token usage with filters.
     */
    async getUsageSummary(filter: TokenUsageFilter): Promise<TokenUsageSummary> {
        if (dbUnavailable) {
            return createEmptyTokenUsageSummary();
        }

        const query: Record<string, unknown> = {};

        if (filter.from || filter.to) {
            query.timestamp = {};
            if (filter.from) {
                (query.timestamp as Record<string, unknown>).$gte = filter.from;
            }
            if (filter.to) {
                (query.timestamp as Record<string, unknown>).$lte = filter.to;
            }
        }

        if (filter.runId && ObjectId.isValid(filter.runId)) {
            query.runId = new ObjectId(filter.runId);
        }

        if (filter.chainId && ObjectId.isValid(filter.chainId)) {
            query.chainId = new ObjectId(filter.chainId);
        }

        if (filter.workspaceId && ObjectId.isValid(filter.workspaceId)) {
            query.workspaceId = new ObjectId(filter.workspaceId);
        }

        if (filter.provider) {
            query.provider = filter.provider;
        }

        if (filter.model) {
            query.model = filter.model;
        }

        try {
            const db = await getDb();
            const logs = await db.collection(COLLECTION_NAME).find(query).toArray();

            const summary = createEmptyTokenUsageSummary();
            for (const log of logs) {
                const record = log as unknown as TokenUsageRecord;
                accumulateUsage(summary, record.usage, record.provider, record.model);
            }

            return summary;
        } catch (error) {
            dbUnavailable = true;
            warnDbUnavailable(error);
            return createEmptyTokenUsageSummary();
        }
    }

    /**
     * Get detailed usage logs (for debugging/admin views).
     */
    async getUsageLogs(
        filter: TokenUsageFilter,
        limit = 100
    ): Promise<TokenUsageRecord[]> {
        const db = await getDb();

        const query: Record<string, unknown> = {};

        if (filter.from || filter.to) {
            query.timestamp = {};
            if (filter.from) {
                (query.timestamp as Record<string, unknown>).$gte = filter.from;
            }
            if (filter.to) {
                (query.timestamp as Record<string, unknown>).$lte = filter.to;
            }
        }

        if (filter.runId && ObjectId.isValid(filter.runId)) {
            query.runId = new ObjectId(filter.runId);
        }

        if (filter.workspaceId && ObjectId.isValid(filter.workspaceId)) {
            query.workspaceId = new ObjectId(filter.workspaceId);
        }

        const logs = await db
            .collection(COLLECTION_NAME)
            .find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();

        return logs as unknown as TokenUsageRecord[];
    }
}

/**
 * Singleton instance of TokenUsageService
 */
export const tokenUsageService = new TokenUsageService();

// Re-export types for convenience
export type { TokenUsage, TokenUsageRecord, TokenUsageSummary, TokenUsageFilter };
export { createEmptyTokenUsage, createEmptyTokenUsageSummary };
