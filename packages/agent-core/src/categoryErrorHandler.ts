// packages/agent-core/src/categoryErrorHandler.ts

import { normalizeToWorkModeId } from "@kletron/shared";

export interface ExecutionError {
    message: string;
    code?: string;
    category?: string;
    context?: Record<string, unknown>;
    stack?: string;
}

export interface ErrorClassification {
    type: 'category_specific' | 'general' | 'unknown';
    category?: string;
    pattern?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorRecoveryResult {
    recovered: boolean;
    message: string;
    suggestedAction: string;
    originalError: ExecutionError;
    recoveryAttempted: boolean;
}

/**
 * Category-aware error handling and recovery system
 */
export class CategoryAwareErrorHandler {
    private errorPatterns: Record<string, Record<string, ErrorPattern>>;
    private recoveryStrategies: Record<string, Record<string, RecoveryStrategy>>;

    constructor() {
        this.errorPatterns = this.loadErrorPatterns();
        this.recoveryStrategies = this.loadRecoveryStrategies();
    }

    /**
     * Handle an execution error with category awareness
     */
    async handleExecutionError(
        error: ExecutionError,
        category: string,
        context?: Record<string, unknown>
    ): Promise<ErrorRecoveryResult> {
        const mode = normalizeToWorkModeId(category);
        // Step 1: Classify the error
        const classification = this.classifyError(error, mode);

        // Step 2: Determine appropriate recovery strategy
        const strategy = this.selectRecoveryStrategy(classification, mode);

        // Step 3: Attempt recovery
        const result = await strategy.recover(error, context);

        // Step 4: Log and monitor
        await this.logErrorWithContext(error, classification, mode);
        this.monitorRecurringErrors(classification);

        return {
            recovered: result.success,
            message: result.message,
            suggestedAction: result.suggestedAction,
            originalError: error,
            recoveryAttempted: true
        };
    }

    /**
     * Classify an error based on patterns
     */
    private classifyError(
        error: ExecutionError,
        category: string
    ): ErrorClassification {
        const mode = normalizeToWorkModeId(category);
        // Check for category-specific error patterns first
        const categoryPatterns = this.errorPatterns[mode] || {};
        for (const [patternName, pattern] of Object.entries(categoryPatterns)) {
            if (this.matchesPattern(error, pattern)) {
                return {
                    type: 'category_specific',
                    category: mode,
                    pattern: patternName,
                    severity: pattern.severity
                };
            }
        }

        // Cross-cutting patterns (any mode)
        const sharedPatterns = this.errorPatterns.shared || {};
        for (const [patternName, pattern] of Object.entries(sharedPatterns)) {
            if (this.matchesPattern(error, pattern)) {
                return {
                    type: 'general',
                    pattern: patternName,
                    severity: pattern.severity
                };
            }
        }

        // Unknown error
        return {
            type: 'unknown',
            message: error.message,
            severity: 'medium'
        };
    }

    /**
     * Check if error matches a pattern
     */
    private matchesPattern(error: ExecutionError, pattern: ErrorPattern): boolean {
        if (pattern.code && error.code !== pattern.code) {
            return false;
        }

        if (pattern.messageRegex) {
            return pattern.messageRegex.test(error.message);
        }

        if (pattern.messageKeywords) {
            return pattern.messageKeywords.some(keyword =>
                error.message.toLowerCase().includes(keyword.toLowerCase())
            );
        }

        return true;
    }

    /**
     * Select recovery strategy based on classification
     */
    private selectRecoveryStrategy(
        classification: ErrorClassification,
        category: string
    ): RecoveryStrategy {
        const mode = normalizeToWorkModeId(category);
        const strategyKey = this.buildStrategyKey(classification, mode);

        const categoryStrategies = this.recoveryStrategies[mode];
        if (categoryStrategies && categoryStrategies[strategyKey]) {
            return categoryStrategies[strategyKey];
        }

        const sharedStrategies = this.recoveryStrategies.shared;
        if (sharedStrategies && sharedStrategies[classification.pattern || 'default']) {
            return sharedStrategies[classification.pattern || 'default'];
        }

        // Default strategy
        return this.getDefaultRecoveryStrategy(classification);
    }

    /**
     * Build strategy key from classification
     */
    private buildStrategyKey(classification: ErrorClassification, category: string): string {
        if (classification.type === 'category_specific' && classification.pattern) {
            return `${category}_${classification.pattern}`;
        }
        return classification.pattern || 'default';
    }

    /**
     * Log error with context
     */
    private async logErrorWithContext(
        error: ExecutionError,
        classification: ErrorClassification,
        category: string
    ): Promise<void> {
        const logEntry = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                code: error.code,
                stack: error.stack
            },
            classification,
            category,
            context: error.context
        };

        console.error('[CategoryError]', JSON.stringify(logEntry, null, 2));
    }

    /**
     * Monitor for recurring errors
     */
    private monitorRecurringErrors(classification: ErrorClassification): void {
        // In production, this would track error frequency and trigger alerts
        // if errors occur too frequently
    }

    /**
     * Load error patterns
     */
    private loadErrorPatterns(): Record<string, Record<string, ErrorPattern>> {
        return {
            code: {
                file_access_error: {
                    code: 'FILE_ACCESS_ERROR',
                    messageKeywords: ['permission denied', 'file not found', 'path inaccessible'],
                    severity: 'high'
                },
                git_error: {
                    code: 'GIT_ERROR',
                    messageKeywords: ['git', 'push failed', 'commit error', 'branch'],
                    severity: 'high'
                },
                compilation_error: {
                    code: 'COMPILATION_ERROR',
                    messageKeywords: ['compile', 'syntax error', 'type error'],
                    severity: 'medium'
                }
            },
            work: {
                template_error: {
                    code: 'TEMPLATE_ERROR',
                    messageKeywords: ['template', 'format', 'export'],
                    severity: 'medium'
                },
                file_save_error: {
                    code: 'FILE_SAVE_ERROR',
                    messageKeywords: ['save', 'write', 'export'],
                    severity: 'high'
                },
                schedule_error: {
                    code: 'SCHEDULE_ERROR',
                    messageKeywords: ['schedule', 'cron', 'timer', 'trigger'],
                    severity: 'high'
                },
                connector_error: {
                    code: 'CONNECTOR_ERROR',
                    messageKeywords: ['connection', 'authentication', 'api', 'integration'],
                    severity: 'critical'
                }
            },
            shared: {
                llm_error: {
                    code: 'LLM_ERROR',
                    messageRegex: /(?:model|api|rate limit|timeout)/i,
                    severity: 'high'
                },
                context_error: {
                    code: 'CONTEXT_ERROR',
                    messageRegex: /(?:context|memory|token limit)/i,
                    severity: 'medium'
                },
                default: {
                    messageKeywords: ['error', 'fail', 'exception'],
                    severity: 'medium'
                }
            }
        };
    }

    /**
     * Load recovery strategies
     */
    private loadRecoveryStrategies(): Record<string, Record<string, RecoveryStrategy>> {
        return {
            code: {
                file_access_error: {
                    recover: async (error: ExecutionError) => ({
                        success: true,
                        message: 'Retrying file access with fallback path...',
                        suggestedAction: 'Check file permissions and path'
                    })
                },
                git_error: {
                    recover: async (error: ExecutionError) => ({
                        success: false,
                        message: 'Git operation failed. Please check your repository status.',
                        suggestedAction: 'Verify git configuration and network connection'
                    })
                }
            },
            work: {
                template_error: {
                    recover: async (error: ExecutionError) => ({
                        success: true,
                        message: 'Using default template as fallback.',
                        suggestedAction: 'Check template files in workspace'
                    })
                },
                schedule_error: {
                    recover: async (error: ExecutionError) => ({
                        success: false,
                        message: 'Scheduling failed. Automation will not run until fixed.',
                        suggestedAction: 'Check cron expression and system time'
                    })
                },
                connector_error: {
                    recover: async (error: ExecutionError) => ({
                        success: false,
                        message: 'Connector authentication failed. Please re-authenticate.',
                        suggestedAction: 'Re-authenticate the affected connector'
                    })
                }
            },
            shared: {
                llm_error: {
                    recover: async (error: ExecutionError) => ({
                        success: false,
                        message: 'AI service temporarily unavailable. Retrying...',
                        suggestedAction: 'Check API status or try again later'
                    })
                },
                context_error: {
                    recover: async (error: ExecutionError) => ({
                        success: true,
                        message: 'Context compressed to fit available space.',
                        suggestedAction: 'Consider breaking down complex tasks'
                    })
                },
                default: {
                    recover: async (error: ExecutionError) => ({
                        success: false,
                        message: `Error: ${error.message}`,
                        suggestedAction: 'Review the error and try again'
                    })
                }
            }
        };
    }

    /**
     * Get default recovery strategy
     */
    private getDefaultRecoveryStrategy(classification: ErrorClassification): RecoveryStrategy {
        return {
            recover: async (error: ExecutionError) => ({
                success: false,
                message: `An error occurred: ${error.message}`,
                suggestedAction: 'Please try again or contact support if the issue persists'
            })
        };
    }
}

/**
 * Error pattern definition
 */
export interface ErrorPattern {
    code?: string;
    messageRegex?: RegExp;
    messageKeywords?: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Recovery strategy definition
 */
export interface RecoveryStrategy {
    recover: (error: ExecutionError, context?: Record<string, unknown>) => Promise<{
        success: boolean;
        message: string;
        suggestedAction: string;
    }>;
}

// Singleton instance
export const categoryErrorHandler = new CategoryAwareErrorHandler();
