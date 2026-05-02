// packages/agent-core/src/categoryPerformanceOptimizer.ts

import { normalizeToWorkModeId } from "@kletron/shared";

export interface CategoryProfile {
    maxTokens: number;
    temperature: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    expectedLatency: number;
    toolParallelism: number;
    contextWindowSize: 'small' | 'medium' | 'large';
}

export interface OptimizationConfig extends CategoryProfile {
    adjustedAt: Date;
    adjustmentReason: string;
}

export interface PerformanceMetrics {
    avgLatency: number;
    successRate: number;
    tokenUsage: number;
    errorCount: number;
    lastUpdated: Date;
}

/**
 * Category-specific performance optimization system
 */
export class CategoryPerformanceOptimizer {
    private categoryProfiles: Record<string, CategoryProfile>;
    private performanceHistory: Map<string, Array<{ timestamp: Date; latency: number; success: boolean; tokens: number }>>;

    constructor() {
        this.categoryProfiles = this.loadCategoryProfiles();
        this.performanceHistory = new Map();
    }

    /**
     * Get optimized configuration for a category
     */
    async optimizeForCategory(categoryId: string): Promise<OptimizationConfig> {
        const mode = normalizeToWorkModeId(categoryId);
        const profile = this.categoryProfiles[mode] || this.getDefaultProfile();
        const history = this.getHistory(mode);

        if (history.length < 3) {
            return {
                ...profile,
                adjustedAt: new Date(),
                adjustmentReason: 'Insufficient history for optimization'
            };
        }

        // Adjust based on historical performance
        return this.applyHistoricalAdjustments(profile, history);
    }

    /**
     * Record a performance metric
     */
    recordMetric(
        categoryId: string,
        latency: number,
        success: boolean,
        tokens: number
    ): void {
        const mode = normalizeToWorkModeId(categoryId);
        const history = this.performanceHistory.get(mode) || [];
        history.push({
            timestamp: new Date(),
            latency,
            success,
            tokens
        });

        this.performanceHistory.set(mode, history.length > 100 ? history.slice(-100) : history);
    }

    /**
     * Get performance metrics for a category
     */
    getMetrics(categoryId: string): PerformanceMetrics {
        const mode = normalizeToWorkModeId(categoryId);
        const history = this.performanceHistory.get(mode) || [];

        if (history.length === 0) {
            return {
                avgLatency: 0,
                successRate: 0,
                tokenUsage: 0,
                errorCount: 0,
                lastUpdated: new Date()
            };
        }

        const avgLatency = history.reduce((sum, h) => sum + h.latency, 0) / history.length;
        const successRate = history.filter(h => h.success).length / history.length;
        const tokenUsage = history.reduce((sum, h) => sum + h.tokens, 0);
        const errorCount = history.filter(h => !h.success).length;

        return {
            avgLatency,
            successRate,
            tokenUsage,
            errorCount,
            lastUpdated: new Date()
        };
    }

    /**
     * Apply historical adjustments to a profile
     */
    private applyHistoricalAdjustments(
        profile: CategoryProfile,
        history: Array<{ timestamp: Date; latency: number; success: boolean; tokens: number }>
    ): OptimizationConfig {
        const recent = history.slice(-10); // Last 10 executions

        const avgLatency = recent.reduce((sum, h) => sum + h.latency, 0) / recent.length;
        const avgTokens = recent.reduce((sum, h) => sum + h.tokens, 0) / recent.length;

        let adjustments: string[] = [];
        let adjusted = { ...profile };

        // Adjust based on average latency
        if (avgLatency > profile.expectedLatency * 1.5) {
            // If consistently slower, reduce parallelism
            adjusted.toolParallelism = Math.max(1, Math.floor(profile.toolParallelism * 0.8));
            adjusted.maxTokens = Math.min(8192, Math.floor(profile.maxTokens * 1.2));
            adjustments.push('Reduced parallelism due to high latency');
        }

        if (avgLatency < profile.expectedLatency * 0.7) {
            // If consistently faster, be more aggressive
            adjusted.toolParallelism = Math.min(6, profile.toolParallelism + 1);
            adjusted.maxTokens = Math.max(2048, Math.floor(profile.maxTokens * 0.9));
            adjustments.push('Increased parallelism due to low latency');
        }

        // Adjust based on success rate
        const successRate = recent.filter(h => h.success).length / recent.length;
        if (successRate < 0.8) {
            // Lower temperature for more consistent results
            adjusted.temperature = Math.max(0.1, profile.temperature - 0.1);
            adjustments.push('Lowered temperature due to low success rate');
        }

        // Adjust context window based on token usage
        if (avgTokens > profile.maxTokens * 0.9) {
            adjusted.contextWindowSize = 'large';
            adjustments.push('Increased context window due to high token usage');
        } else if (avgTokens < profile.maxTokens * 0.3) {
            adjusted.contextWindowSize = 'small';
            adjustments.push('Reduced context window due to low token usage');
        }

        return {
            ...adjusted,
            adjustedAt: new Date(),
            adjustmentReason: adjustments.join('; ') || 'No adjustments needed'
        };
    }

    /**
     * Load default category profiles
     */
    private loadCategoryProfiles(): Record<string, CategoryProfile> {
        return {
            code: {
                maxTokens: 4096,
                temperature: 0.1,
                topP: 0.9,
                frequencyPenalty: 0.2,
                presencePenalty: 0.5,
                expectedLatency: 1500,
                toolParallelism: 3,
                contextWindowSize: 'large'
            },
            work: {
                maxTokens: 8192,
                temperature: 0.35,
                topP: 0.95,
                frequencyPenalty: 0,
                presencePenalty: 0.2,
                expectedLatency: 1800,
                toolParallelism: 2,
                contextWindowSize: 'medium'
            }
        };
    }

    /**
     * Get default profile
     */
    private getDefaultProfile(): CategoryProfile {
        return {
            maxTokens: 4096,
            temperature: 0.3,
            topP: 0.9,
            frequencyPenalty: 0,
            presencePenalty: 0,
            expectedLatency: 1500,
            toolParallelism: 2,
            contextWindowSize: 'medium'
        };
    }

    /**
     * Get performance history for a category
     */
    private getHistory(categoryId: string): Array<{ timestamp: Date; latency: number; success: boolean; tokens: number }> {
        return this.performanceHistory.get(normalizeToWorkModeId(categoryId)) || [];
    }
}

// Singleton instance
export const categoryPerformanceOptimizer = new CategoryPerformanceOptimizer();
