import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { ObjectId } from 'mongodb';
import {
    TokenUsage,
    TokenUsageSummary,
    createEmptyTokenUsage,
    createEmptyTokenUsageSummary,
    addTokenUsage,
    accumulateUsage,
} from '@kletron/server/services/tokenUsageTypes';
import { TokenUsageService } from '@kletron/server/services/tokenUsageService';

// Mock MongoDB
vi.mock('@kletron/server/lib/db', () => ({
    getDb: vi.fn(() => Promise.resolve({
        collection: () => ({
            insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId() }),
            find: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
                sort: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
            }),
        }),
    })),
}));

/**
 * Comprehensive integration tests for token usage tracking.
 * Verifies the complete flow from logging to aggregation to retrieval.
 */
describe('Token Usage Integration', () => {
    let service: TokenUsageService;

    beforeEach(() => {
        service = new TokenUsageService();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Full Run Lifecycle', () => {
        it('should track tokens through complete run lifecycle', async () => {
            const runId = new ObjectId().toString();
            const nodeId1 = 'node-1';
            const nodeId2 = 'node-2';

            // 1. Start tracking
            service.startRunTracking(runId);

            // 2. Log usage for node 1 (multiple calls)
            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                runId: new ObjectId(runId),
                nodeId: nodeId1,
                callType: 'react_agent',
            });

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
                runId: new ObjectId(runId),
                nodeId: nodeId1,
                callType: 'react_agent',
            });

            // 3. Verify node 1 accumulated correctly
            const node1Usage = service.getNodeUsage(runId, nodeId1);
            expect(node1Usage.inputTokens).toBe(300);
            expect(node1Usage.outputTokens).toBe(150);
            expect(node1Usage.totalTokens).toBe(450);

            // 4. Log usage for node 2
            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o-mini',
                usage: { inputTokens: 500, outputTokens: 250, totalTokens: 750 },
                runId: new ObjectId(runId),
                nodeId: nodeId2,
                callType: 'react_agent',
            });

            // 5. Verify node 2 accumulated correctly
            const node2Usage = service.getNodeUsage(runId, nodeId2);
            expect(node2Usage.inputTokens).toBe(500);
            expect(node2Usage.outputTokens).toBe(250);
            expect(node2Usage.totalTokens).toBe(750);

            // 6. Verify run-level accumulation
            const runUsage = service.getRunAccumulatedUsage(runId);
            expect(runUsage.totalInputTokens).toBe(800); // 300 + 500
            expect(runUsage.totalOutputTokens).toBe(400); // 150 + 250
            expect(runUsage.totalTokens).toBe(1200); // 450 + 750
            expect(runUsage.callCount).toBe(3);

            // 7. Verify by-model tracking
            expect(runUsage.byModel['gpt-4o'].totalTokens).toBe(450);
            expect(runUsage.byModel['gpt-4o-mini'].totalTokens).toBe(750);

            // 8. Finalize and verify result
            const { summary, nodeUsage } = service.finalizeRunTracking(runId);
            expect(summary.totalTokens).toBe(1200);
            expect(summary.callCount).toBe(3);
            expect(nodeUsage[nodeId1].totalTokens).toBe(450);
            expect(nodeUsage[nodeId2].totalTokens).toBe(750);

            // 9. Verify state is cleared after finalization
            const afterFinal = service.getRunAccumulatedUsage(runId);
            expect(afterFinal.totalTokens).toBe(0);
        });

        it('should handle concurrent runs independently', async () => {
            const run1 = new ObjectId().toString();
            const run2 = new ObjectId().toString();

            service.startRunTracking(run1);
            service.startRunTracking(run2);

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                runId: new ObjectId(run1),
                nodeId: 'node-a',
                callType: 'react_agent',
            });

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
                runId: new ObjectId(run2),
                nodeId: 'node-b',
                callType: 'react_agent',
            });

            const run1Usage = service.getRunAccumulatedUsage(run1);
            const run2Usage = service.getRunAccumulatedUsage(run2);

            expect(run1Usage.totalTokens).toBe(150);
            expect(run2Usage.totalTokens).toBe(1500);
        });

        it('should handle logging to untracked run gracefully (no accumulation)', async () => {
            const runId = new ObjectId();

            // Log without starting tracking - should not throw
            await expect(service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                runId,
                nodeId: 'node-1',
                callType: 'react_agent',
            })).resolves.not.toThrow();

            // No in-memory accumulation (but DB insert still happens)
            const usage = service.getRunAccumulatedUsage(runId.toString());
            expect(usage.totalTokens).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero token usage', async () => {
            const runId = new ObjectId().toString();
            service.startRunTracking(runId);

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            const usage = service.getNodeUsage(runId, 'node-1');
            expect(usage.totalTokens).toBe(0);
        });

        it('should handle very large token counts', async () => {
            const runId = new ObjectId().toString();
            service.startRunTracking(runId);

            // Simulate large context windows (128k tokens)
            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 100000, outputTokens: 50000, totalTokens: 150000 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 100000, outputTokens: 50000, totalTokens: 150000 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            const usage = service.getNodeUsage(runId, 'node-1');
            expect(usage.totalTokens).toBe(300000);
        });

        it('should handle multiple models per node', async () => {
            const runId = new ObjectId().toString();
            service.startRunTracking(runId);

            // First call with gpt-4o
            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            // Second call with gpt-4o-mini
            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o-mini',
                usage: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            const runUsage = service.getRunAccumulatedUsage(runId);
            expect(runUsage.byModel['gpt-4o'].totalTokens).toBe(1500);
            expect(runUsage.byModel['gpt-4o-mini'].totalTokens).toBe(3000);
            expect(runUsage.totalTokens).toBe(4500);
        });

        it('should handle multiple providers', async () => {
            const runId = new ObjectId().toString();
            service.startRunTracking(runId);

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            await service.logUsage({
                timestamp: new Date(),
                provider: 'lmstudio',
                model: 'llama3',
                usage: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 },
                runId: new ObjectId(runId),
                nodeId: 'node-2',
                callType: 'react_agent',
            });

            const runUsage = service.getRunAccumulatedUsage(runId);
            expect(runUsage.byProvider['azure'].totalTokens).toBe(1500);
            expect(runUsage.byProvider['lmstudio'].totalTokens).toBe(3000);
        });
    });

    describe('Data Integrity', () => {
        it('should maintain accurate count through rapid sequential logging', async () => {
            const runId = new ObjectId().toString();
            service.startRunTracking(runId);

            const iterations = 100;
            const tokensPerCall = 150;

            for (let i = 0; i < iterations; i++) {
                await service.logUsage({
                    timestamp: new Date(),
                    provider: 'azure',
                    model: 'gpt-4o',
                    usage: { inputTokens: 100, outputTokens: 50, totalTokens: tokensPerCall },
                    runId: new ObjectId(runId),
                    nodeId: 'node-1',
                    callType: 'react_agent',
                });
            }

            const usage = service.getNodeUsage(runId, 'node-1');
            expect(usage.totalTokens).toBe(iterations * tokensPerCall);
            expect(usage.inputTokens).toBe(iterations * 100);
            expect(usage.outputTokens).toBe(iterations * 50);

            const runUsage = service.getRunAccumulatedUsage(runId);
            expect(runUsage.callCount).toBe(iterations);
        });

        it('should never lose tokens during finalization', async () => {
            const runId = new ObjectId().toString();
            service.startRunTracking(runId);

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            const beforeFinalize = service.getRunAccumulatedUsage(runId);
            const { summary } = service.finalizeRunTracking(runId);

            // Final result should exactly match what was accumulated
            expect(summary.totalTokens).toBe(beforeFinalize.totalTokens);
            expect(summary.totalInputTokens).toBe(beforeFinalize.totalInputTokens);
            expect(summary.totalOutputTokens).toBe(beforeFinalize.totalOutputTokens);
        });

        it('should return accurate nodeUsage map on finalization', async () => {
            const runId = new ObjectId().toString();
            service.startRunTracking(runId);

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                runId: new ObjectId(runId),
                nodeId: 'node-1',
                callType: 'react_agent',
            });

            await service.logUsage({
                timestamp: new Date(),
                provider: 'azure',
                model: 'gpt-4o',
                usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
                runId: new ObjectId(runId),
                nodeId: 'node-2',
                callType: 'react_agent',
            });

            const { nodeUsage } = service.finalizeRunTracking(runId);

            expect(Object.keys(nodeUsage)).toHaveLength(2);
            expect(nodeUsage['node-1'].totalTokens).toBe(150);
            expect(nodeUsage['node-2'].totalTokens).toBe(300);
        });
    });
});

describe('TokenUsage Type Utilities', () => {
    describe('addTokenUsage', () => {
        it('should correctly sum all fields', () => {
            const a: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
            const b: TokenUsage = { inputTokens: 200, outputTokens: 100, totalTokens: 300 };

            const result = addTokenUsage(a, b);

            expect(result.inputTokens).toBe(300);
            expect(result.outputTokens).toBe(150);
            expect(result.totalTokens).toBe(450);
        });

        it('should be commutative (a + b = b + a)', () => {
            const a: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
            const b: TokenUsage = { inputTokens: 200, outputTokens: 100, totalTokens: 300 };

            expect(addTokenUsage(a, b)).toEqual(addTokenUsage(b, a));
        });

        it('should be associative ((a + b) + c = a + (b + c))', () => {
            const a: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
            const b: TokenUsage = { inputTokens: 200, outputTokens: 100, totalTokens: 300 };
            const c: TokenUsage = { inputTokens: 300, outputTokens: 150, totalTokens: 450 };

            expect(addTokenUsage(addTokenUsage(a, b), c)).toEqual(addTokenUsage(a, addTokenUsage(b, c)));
        });

        it('should have identity element (a + 0 = a)', () => {
            const a: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
            const zero = createEmptyTokenUsage();

            expect(addTokenUsage(a, zero)).toEqual(a);
        });

        it('should not mutate original objects', () => {
            const a: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
            const b: TokenUsage = { inputTokens: 200, outputTokens: 100, totalTokens: 300 };
            const originalA = { ...a };
            const originalB = { ...b };

            addTokenUsage(a, b);

            expect(a).toEqual(originalA);
            expect(b).toEqual(originalB);
        });
    });

    describe('accumulateUsage', () => {
        it('should correctly update all summary fields', () => {
            const summary = createEmptyTokenUsageSummary();
            const usage: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };

            accumulateUsage(summary, usage, 'azure', 'gpt-4o');

            expect(summary.totalInputTokens).toBe(100);
            expect(summary.totalOutputTokens).toBe(50);
            expect(summary.totalTokens).toBe(150);
            expect(summary.callCount).toBe(1);
        });

        it('should increment callCount for each accumulation', () => {
            const summary = createEmptyTokenUsageSummary();
            const usage: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };

            accumulateUsage(summary, usage, 'azure', 'gpt-4o');
            accumulateUsage(summary, usage, 'azure', 'gpt-4o');
            accumulateUsage(summary, usage, 'azure', 'gpt-4o');

            expect(summary.callCount).toBe(3);
        });

        it('should track usage by model correctly', () => {
            const summary = createEmptyTokenUsageSummary();

            accumulateUsage(summary, { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, 'azure', 'gpt-4o');
            accumulateUsage(summary, { inputTokens: 200, outputTokens: 100, totalTokens: 300 }, 'azure', 'gpt-4o');
            accumulateUsage(summary, { inputTokens: 50, outputTokens: 25, totalTokens: 75 }, 'azure', 'gpt-4o-mini');

            expect(summary.byModel['gpt-4o'].totalTokens).toBe(450);
            expect(summary.byModel['gpt-4o-mini'].totalTokens).toBe(75);
        });

        it('should track usage by provider correctly', () => {
            const summary = createEmptyTokenUsageSummary();

            accumulateUsage(summary, { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, 'azure', 'gpt-4o');
            accumulateUsage(summary, { inputTokens: 200, outputTokens: 100, totalTokens: 300 }, 'lmstudio', 'llama3');

            expect(summary.byProvider['azure'].totalTokens).toBe(150);
            expect(summary.byProvider['lmstudio'].totalTokens).toBe(300);
        });
    });

    describe('createEmptyTokenUsage', () => {
        it('should create a TokenUsage with all zeros', () => {
            const usage = createEmptyTokenUsage();

            expect(usage.inputTokens).toBe(0);
            expect(usage.outputTokens).toBe(0);
            expect(usage.totalTokens).toBe(0);
        });

        it('should create independent instances', () => {
            const usage1 = createEmptyTokenUsage();
            const usage2 = createEmptyTokenUsage();

            usage1.inputTokens = 100;

            expect(usage2.inputTokens).toBe(0);
        });
    });

    describe('createEmptyTokenUsageSummary', () => {
        it('should create a TokenUsageSummary with all zeros and empty maps', () => {
            const summary = createEmptyTokenUsageSummary();

            expect(summary.totalInputTokens).toBe(0);
            expect(summary.totalOutputTokens).toBe(0);
            expect(summary.totalTokens).toBe(0);
            expect(summary.callCount).toBe(0);
            expect(Object.keys(summary.byModel)).toHaveLength(0);
            expect(Object.keys(summary.byProvider)).toHaveLength(0);
        });
    });
});
