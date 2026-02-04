import type { ObjectId } from "mongodb";
import type { LlmProviderType } from "@/src/schemas/llmConfig.schema";

/**
 * Token usage for a single LLM call
 */
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

/**
 * Create a zero-initialized TokenUsage object
 */
export function createEmptyTokenUsage(): TokenUsage {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/**
 * Add two TokenUsage objects together
 */
export function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
    return {
        inputTokens: a.inputTokens + b.inputTokens,
        outputTokens: a.outputTokens + b.outputTokens,
        totalTokens: a.totalTokens + b.totalTokens,
    };
}

/**
 * Call type for categorizing token usage
 */
export type TokenUsageCallType = "react_agent" | "chain_stage" | "embedding" | "other";

/**
 * Individual token usage record for granular logging
 */
export interface TokenUsageRecord {
    _id?: ObjectId;
    timestamp: Date;
    provider: LlmProviderType;
    model: string;
    usage: TokenUsage;
    // Scoping
    runId?: ObjectId;
    nodeId?: string;
    chainId?: ObjectId;
    stageId?: string;
    // Metadata
    callType: TokenUsageCallType;
}

/**
 * Aggregated token usage summary
 */
export interface TokenUsageSummary {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    callCount: number;
    byModel: Record<string, TokenUsage>;
    byProvider: Record<string, TokenUsage>;
}

/**
 * Create a zero-initialized TokenUsageSummary object
 */
export function createEmptyTokenUsageSummary(): TokenUsageSummary {
    return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        callCount: 0,
        byModel: {},
        byProvider: {},
    };
}

/**
 * Add a TokenUsage to a TokenUsageSummary (mutates summary)
 */
export function accumulateUsage(
    summary: TokenUsageSummary,
    usage: TokenUsage,
    provider: string,
    model: string
): void {
    summary.totalInputTokens += usage.inputTokens;
    summary.totalOutputTokens += usage.outputTokens;
    summary.totalTokens += usage.totalTokens;
    summary.callCount += 1;

    // Accumulate by model
    if (!summary.byModel[model]) {
        summary.byModel[model] = createEmptyTokenUsage();
    }
    summary.byModel[model] = addTokenUsage(summary.byModel[model], usage);

    // Accumulate by provider
    if (!summary.byProvider[provider]) {
        summary.byProvider[provider] = createEmptyTokenUsage();
    }
    summary.byProvider[provider] = addTokenUsage(summary.byProvider[provider], usage);
}

/**
 * Filter options for querying token usage
 */
export interface TokenUsageFilter {
    from?: Date;
    to?: Date;
    runId?: string;
    chainId?: string;
    provider?: LlmProviderType;
    model?: string;
}
