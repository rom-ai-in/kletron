import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    TokenUsage,
    TokenUsageSummary,
    createEmptyTokenUsage,
    createEmptyTokenUsageSummary,
    addTokenUsage,
    accumulateUsage,
} from "@numezis/server/services/tokenUsageTypes";

describe("Token Usage Types", () => {
    describe("createEmptyTokenUsage", () => {
        it("should create a TokenUsage with all zeros", () => {
            const usage = createEmptyTokenUsage();
            expect(usage.inputTokens).toBe(0);
            expect(usage.outputTokens).toBe(0);
            expect(usage.totalTokens).toBe(0);
        });
    });

    describe("createEmptyTokenUsageSummary", () => {
        it("should create a TokenUsageSummary with all zeros and empty maps", () => {
            const summary = createEmptyTokenUsageSummary();
            expect(summary.totalInputTokens).toBe(0);
            expect(summary.totalOutputTokens).toBe(0);
            expect(summary.totalTokens).toBe(0);
            expect(summary.callCount).toBe(0);
            expect(summary.byModel).toEqual({});
            expect(summary.byProvider).toEqual({});
        });
    });

    describe("addTokenUsage", () => {
        it("should add two TokenUsage objects correctly", () => {
            const a: TokenUsage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
            const b: TokenUsage = { inputTokens: 5, outputTokens: 15, totalTokens: 20 };
            const result = addTokenUsage(a, b);

            expect(result.inputTokens).toBe(15);
            expect(result.outputTokens).toBe(35);
            expect(result.totalTokens).toBe(50);
        });

        it("should not mutate original objects", () => {
            const a: TokenUsage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
            const b: TokenUsage = { inputTokens: 5, outputTokens: 15, totalTokens: 20 };
            addTokenUsage(a, b);

            expect(a.inputTokens).toBe(10);
            expect(b.inputTokens).toBe(5);
        });
    });

    describe("accumulateUsage", () => {
        it("should accumulate usage into summary", () => {
            const summary = createEmptyTokenUsageSummary();
            const usage: TokenUsage = { inputTokens: 100, outputTokens: 200, totalTokens: 300 };

            accumulateUsage(summary, usage, "openai", "gpt-4");

            expect(summary.totalInputTokens).toBe(100);
            expect(summary.totalOutputTokens).toBe(200);
            expect(summary.totalTokens).toBe(300);
            expect(summary.callCount).toBe(1);
        });

        it("should track usage by model", () => {
            const summary = createEmptyTokenUsageSummary();
            const usage1: TokenUsage = { inputTokens: 100, outputTokens: 200, totalTokens: 300 };
            const usage2: TokenUsage = { inputTokens: 50, outputTokens: 100, totalTokens: 150 };

            accumulateUsage(summary, usage1, "openai", "gpt-4");
            accumulateUsage(summary, usage2, "openai", "gpt-4");

            expect(summary.byModel["gpt-4"]).toEqual({
                inputTokens: 150,
                outputTokens: 300,
                totalTokens: 450,
            });
        });

        it("should track usage by provider", () => {
            const summary = createEmptyTokenUsageSummary();
            const usage1: TokenUsage = { inputTokens: 100, outputTokens: 200, totalTokens: 300 };
            const usage2: TokenUsage = { inputTokens: 50, outputTokens: 100, totalTokens: 150 };

            accumulateUsage(summary, usage1, "openai", "gpt-4");
            accumulateUsage(summary, usage2, "azure", "gpt-4");

            expect(summary.byProvider["openai"]).toEqual({
                inputTokens: 100,
                outputTokens: 200,
                totalTokens: 300,
            });
            expect(summary.byProvider["azure"]).toEqual({
                inputTokens: 50,
                outputTokens: 100,
                totalTokens: 150,
            });
        });

        it("should handle multiple models and providers", () => {
            const summary = createEmptyTokenUsageSummary();

            accumulateUsage(summary, { inputTokens: 100, outputTokens: 200, totalTokens: 300 }, "openai", "gpt-4");
            accumulateUsage(summary, { inputTokens: 50, outputTokens: 100, totalTokens: 150 }, "openai", "gpt-3.5-turbo");
            accumulateUsage(summary, { inputTokens: 75, outputTokens: 150, totalTokens: 225 }, "azure", "gpt-4");

            expect(summary.totalInputTokens).toBe(225);
            expect(summary.totalOutputTokens).toBe(450);
            expect(summary.totalTokens).toBe(675);
            expect(summary.callCount).toBe(3);

            expect(Object.keys(summary.byModel)).toHaveLength(2);
            expect(Object.keys(summary.byProvider)).toHaveLength(2);
        });
    });
});

describe("TokenUsageService", () => {
    // Import the class fresh for each test to reset singleton state
    let TokenUsageService: typeof import("@numezis/server/services/tokenUsageService").TokenUsageService;
    let tokenUsageService: InstanceType<typeof TokenUsageService>;

    beforeEach(async () => {
        // Re-import to get fresh instance
        vi.resetModules();
        const module = await import("@numezis/server/services/tokenUsageService");
        TokenUsageService = module.TokenUsageService;
        tokenUsageService = new TokenUsageService();
    });

    describe("startRunTracking", () => {
        it("should initialize tracking for a run", () => {
            tokenUsageService.startRunTracking("run-123");
            const usage = tokenUsageService.getRunAccumulatedUsage("run-123");

            expect(usage.totalInputTokens).toBe(0);
            expect(usage.totalOutputTokens).toBe(0);
            expect(usage.callCount).toBe(0);
        });
    });

    describe("getNodeUsage", () => {
        it("should return empty usage for untracked nodes", () => {
            tokenUsageService.startRunTracking("run-123");
            const usage = tokenUsageService.getNodeUsage("run-123", "node-1");

            expect(usage.inputTokens).toBe(0);
            expect(usage.outputTokens).toBe(0);
            expect(usage.totalTokens).toBe(0);
        });

        it("should return empty usage for untracked runs", () => {
            const usage = tokenUsageService.getNodeUsage("unknown-run", "node-1");

            expect(usage.inputTokens).toBe(0);
            expect(usage.outputTokens).toBe(0);
        });
    });

    describe("finalizeRunTracking", () => {
        it("should return final summary and clear state", () => {
            tokenUsageService.startRunTracking("run-123");

            const { summary, nodeUsage } = tokenUsageService.finalizeRunTracking("run-123");

            expect(summary.totalInputTokens).toBe(0);
            expect(summary.callCount).toBe(0);
            expect(nodeUsage).toEqual({});

            // Should return empty summary after finalization
            const afterFinalize = tokenUsageService.getRunAccumulatedUsage("run-123");
            expect(afterFinalize.callCount).toBe(0);
        });

        it("should handle finalization of untracked runs gracefully", () => {
            const { summary, nodeUsage } = tokenUsageService.finalizeRunTracking("unknown-run");

            expect(summary.totalInputTokens).toBe(0);
            expect(nodeUsage).toEqual({});
        });
    });
});
