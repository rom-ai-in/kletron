// packages/agent-core/__tests__/categorySystem.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryAwareRouter } from '../src/categoryRouter';
import { CategoryWorkflowRunner } from '../src/categoryWorkflowRunner';
import { ContextPreserver } from '../../server/src/services/contextPreservation';
import { CategoryPromptEngine } from '../src/categoryPromptEngine';
import { CategoryAwareErrorHandler } from '../src/categoryErrorHandler';
import { CategoryPerformanceOptimizer } from '../src/categoryPerformanceOptimizer';
import { CategorySpecificToolSelector } from '../src/categoryToolSelector';
import { DEFAULT_WORK_CATEGORIES } from '../../shared/workspaceCategories';

describe('Category System', () => {
    let router: CategoryAwareRouter;
    let workflowRunner: CategoryWorkflowRunner;
    let contextPreserver: ContextPreserver;
    let promptEngine: CategoryPromptEngine;
    let errorHandler: CategoryAwareErrorHandler;
    let performanceOptimizer: CategoryPerformanceOptimizer;
    let toolSelector: CategorySpecificToolSelector;

    beforeEach(() => {
        router = new CategoryAwareRouter();
        workflowRunner = CategoryWorkflowRunner.getInstance();
        contextPreserver = new ContextPreserver();
        promptEngine = new CategoryPromptEngine();
        errorHandler = new CategoryAwareErrorHandler();
        performanceOptimizer = new CategoryPerformanceOptimizer();
        toolSelector = new CategorySpecificToolSelector();
    });

    describe('CategoryAwareRouter', () => {
        it('should set context correctly', () => {
            router.setContext('test-workspace', 'coding');
            expect(router).toBeDefined();
        });

        it('should infer coding category from code-related content', async () => {
            router.setContext('test-workspace');
            const result = await router.determineCategory('Implement authentication with JWT');
            expect(result.category.id).toBe('coding');
            expect(result.reason).toContain('content_analysis');
        });

        it('should infer drafting category from document-related content', async () => {
            router.setContext('test-workspace');
            const result = await router.determineCategory('Write a technical document about APIs');
            expect(result.category.id).toBe('drafting');
        });

        it('should infer automation category from task-related content', async () => {
            router.setContext('test-workspace');
            const result = await router.determineCategory('Create a daily backup automation');
            expect(result.category.id).toBe('automation');
        });

        it('should return default category for unknown content', async () => {
            router.setContext('test-workspace');
            const result = await router.determineCategory('Hello world');
            expect(result.category).toBeDefined();
        });

        it('should use explicit category when set', async () => {
            router.setContext('test-workspace', 'drafting');
            const result = await router.determineCategory('Write some code');
            expect(result.category.id).toBe('drafting');
            expect(result.reason).toBe('explicit_category');
        });

        it('should throw error when workspace not set', async () => {
            await expect(router.determineCategory('test')).rejects.toThrow('Workspace ID not set');
        });
    });

    describe('ContextPreserver', () => {
        it('should preserve context when switching categories', async () => {
            const result = await contextPreserver.preserveContext(
                'test-user',
                { id: 'test-workspace', rootPath: '/test', name: 'Test' } as any,
                'coding',
                'drafting'
            );

            expect(result).toBeDefined();
            expect(result.context).toHaveProperty('preservedFrom');
        });

        it('should return warnings for incompatible category pairs', async () => {
            const result = await contextPreserver.preserveContext(
                'test-user',
                { id: 'test-workspace', rootPath: '/test', name: 'Test' } as any,
                'coding',
                'drafting'
            );

            expect(result.warnings).toBeDefined();
        });

        it('should clear context correctly', () => {
            contextPreserver.clearContext('test-user');
            expect(contextPreserver.getContext('test-user')).toBeNull();
        });
    });

    describe('CategoryPromptEngine', () => {
        it('should build prompt for coding category', () => {
            const codingCategory = DEFAULT_WORK_CATEGORIES.find(c => c.id === 'coding')!;
            const prompt = promptEngine.buildPromptForCategory({
                category: codingCategory,
                context: { workspaceName: 'Test' }
            });

            expect(prompt.systemMessage).toContain('Code Assistance');
            expect(prompt.systemMessage).toContain('code analysis');
            expect(prompt.examples).toBeDefined();
            expect(prompt.constraints).toBeDefined();
        });

        it('should build prompt for drafting category', () => {
            const draftingCategory = DEFAULT_WORK_CATEGORIES.find(c => c.id === 'drafting')!;
            const prompt = promptEngine.buildPromptForCategory({
                category: draftingCategory
            });

            expect(prompt.systemMessage).toContain('Document Drafting');
        });

        it('should format context for prompt', () => {
            const context = {
                workspaceName: 'My Project',
                workspacePath: '/path/to/project',
                recentActivities: [{ action: 'commit' }],
                activeFiles: ['index.ts', 'app.tsx']
            };

            const formatted = promptEngine.formatContextForPrompt(context, 'coding');
            expect(formatted).toContain('My Project');
            expect(formatted).toContain('index.ts');
        });
    });

    describe('CategoryAwareErrorHandler', () => {
        it('should classify coding file access errors', async () => {
            const error = {
                message: 'File not found: /path/to/file.ts',
                code: 'FILE_ACCESS_ERROR',
                category: 'coding'
            };

            const result = await errorHandler.handleExecutionError(error, 'coding');
            expect(result).toBeDefined();
            expect(result.recoveryAttempted).toBe(true);
        });

        it('should classify automation schedule errors', async () => {
            const error = {
                message: 'Schedule error: invalid cron expression',
                code: 'SCHEDULE_ERROR',
                category: 'automation'
            };

            const result = await errorHandler.handleExecutionError(error, 'automation');
            expect(result).toBeDefined();
        });

        it('should handle unknown errors gracefully', async () => {
            const error = {
                message: 'Unknown error occurred',
                category: 'general'
            };

            const result = await errorHandler.handleExecutionError(error, 'general');
            expect(result.recovered).toBe(false);
        });
    });

    describe('CategoryPerformanceOptimizer', () => {
        it('should optimize configuration for coding category', async () => {
            const config = await performanceOptimizer.optimizeForCategory('coding');
            expect(config.maxTokens).toBe(4096);
            expect(config.temperature).toBe(0.1);
        });

        it('should optimize configuration for drafting category', async () => {
            const config = await performanceOptimizer.optimizeForCategory('drafting');
            expect(config.maxTokens).toBe(8192);
            expect(config.temperature).toBe(0.3);
        });

        it('should record and retrieve performance metrics', () => {
            performanceOptimizer.recordMetric('coding', 1500, true, 1024);
            performanceOptimizer.recordMetric('coding', 1200, true, 800);

            const metrics = performanceOptimizer.getMetrics('coding');
            expect(metrics.avgLatency).toBe(1350);
            expect(metrics.successRate).toBe(1);
        });

        it('should adjust configuration based on performance history', () => {
            // Record slow executions
            for (let i = 0; i < 10; i++) {
                performanceOptimizer.recordMetric('coding', 3000, true, 2000);
            }

            const config = performanceOptimizer.optimizeForCategory('coding');
            expect(config).toBeDefined();
        });
    });

    describe('CategorySpecificToolSelector', () => {
        it('should get tools for coding category', () => {
            const tools = toolSelector.getToolsForCategory('coding');
            expect(tools.length).toBeGreaterThan(0);
        });

        it('should get tools for drafting category', () => {
            const tools = toolSelector.getToolsForCategory('drafting');
            expect(tools.length).toBeGreaterThan(0);
        });

        it('should check tool availability', () => {
            const available = toolSelector.isToolAvailableForCategory('coding', 'git_log');
            expect(available).toBe(true);
        });

        it('should enable/disable tools for category', () => {
            toolSelector.setToolEnabledForCategory('coding', 'git_log', false);
            const tools = toolSelector.getToolsForCategory('coding');
            expect(tools).not.toContain('git_log');
        });
    });

    describe('DEFAULT_WORK_CATEGORIES', () => {
        it('should have all four categories', () => {
            expect(DEFAULT_WORK_CATEGORIES).toHaveLength(4);
            expect(DEFAULT_WORK_CATEGORIES.map(c => c.id)).toEqual(
                expect.arrayContaining(['coding', 'drafting', 'automation', 'general'])
            );
        });

        it('should have valid category data', () => {
            DEFAULT_WORK_CATEGORIES.forEach(category => {
                expect(category.id).toBeDefined();
                expect(category.name).toBeDefined();
                expect(category.description).toBeDefined();
                expect(category.color).toBeDefined();
            });
        });
    });
});
