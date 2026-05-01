// packages/agent-core/src/categoryRouter.ts

import type { WorkCategoryId } from '@kletron/shared';
import { DEFAULT_WORK_CATEGORIES } from '@kletron/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface CategoryInferenceResult {
  category: WorkCategoryId;
  confidence: number;
  reason: string;
  matchedKeywords: string[];
}

export interface ExecutionPlan {
  category: WorkCategoryId;
  config: {
    name: string;
    description: string;
    availableTools: string[];
    requiredContextTypes: string[];
    capabilities: Record<string, boolean>;
  };
  prompt: string;
  workflow: 'react' | 'deep-research' | 'audit-chain';
}

// ============================================================================
// CATEGORY AWARE ROUTER
// ============================================================================

export class CategoryAwareRouter {
  private static instance: CategoryAwareRouter;
  private currentCategory: WorkCategoryId = 'coding';
  private keywordPatterns: Record<WorkCategoryId, string[]>;

  private constructor() {
    this.keywordPatterns = this.buildKeywordPatterns();
  }

  static getInstance(): CategoryAwareRouter {
    if (!CategoryAwareRouter.instance) {
      CategoryAwareRouter.instance = new CategoryAwareRouter();
    }
    return CategoryAwareRouter.instance;
  }

  /**
   * Set the current/default category context.
   */
  setContext(workspaceId: string, categoryId?: WorkCategoryId): void {
    if (categoryId) {
      this.currentCategory = categoryId;
    }
  }

  /**
   * Determine the appropriate category for a user input.
   * Uses keyword-based inference with confidence scoring.
   */
  determineCategory(userInput: string): CategoryInferenceResult {
    const input = userInput.toLowerCase();

    // Check for explicit category mention first
    const explicitMatch = this.findExplicitCategoryMention(input);
    if (explicitMatch) {
      return {
        category: explicitMatch,
        confidence: 0.95,
        reason: 'explicit_mention',
        matchedKeywords: [explicitMatch],
      };
    }

    // Score each category
    const scores = this.scoreCategories(input);

    // Find highest scoring category with confidence threshold
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topCategory, topScore] = sorted[0] || ['general', 0];

    if (topScore > 0.7) {
      const matchedKeywords = this.findMatchedKeywords(input, topCategory as WorkCategoryId);
      return {
        category: topCategory as WorkCategoryId,
        confidence: topScore,
        reason: `content_analysis(${topScore.toFixed(2)})`,
        matchedKeywords,
      };
    }

    // Fall back to current category
    return {
      category: this.currentCategory,
      confidence: 0.3,
      reason: 'default_fallback',
      matchedKeywords: [],
    };
  }

  /**
   * Build an execution plan for a user input.
   */
  buildExecutionPlan(userInput: string, context?: { workspacePath?: string; activeFiles?: string[] }): ExecutionPlan {
    const inference = this.determineCategory(userInput);
    const category = inference.category;

    // Get category config
    const categoryConfig = DEFAULT_WORK_CATEGORIES.find((c) => c.id === category);
    const config = categoryConfig
      ? {
          name: categoryConfig.name,
          description: categoryConfig.description,
          availableTools: categoryConfig.commonTools,
          requiredContextTypes: [],
          capabilities: {
            canEditFiles: category === 'coding',
            canAccessExternalServices: category === 'drafting' || category === 'automation',
            canScheduleTasks: category === 'automation',
          },
        }
      : {
          name: 'General',
          description: 'General purpose assistance',
          availableTools: ['web_search', 'fetch_url'],
          requiredContextTypes: [],
          capabilities: {},
        };

    // Determine workflow type
    const workflow = this.determineWorkflow(userInput, category);

    // Build prompt
    const prompt = this.buildExecutionPrompt(category, userInput, context);

    return {
      category,
      config,
      prompt,
      workflow,
    };
  }

  /**
   * Check for explicit category mentions in the input.
   */
  private findExplicitCategoryMention(input: string): WorkCategoryId | null {
    // Check for "in coding mode" or "switch to coding" etc.
    const categoryKeywords: Record<WorkCategoryId, string[]> = {
      coding: ['coding', 'code', 'programming', 'developer'],
      drafting: ['draft', 'document', 'write', 'article'],
      automation: ['automate', 'workflow', 'schedule', 'automation'],
      general: ['general', 'help', 'ask', 'question'],
    };

    for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (input.includes(`in ${keyword}`) || input.includes(`to ${keyword}`) || input.includes(`switch to ${keyword}`)) {
          return categoryId as WorkCategoryId;
        }
      }
    }

    return null;
  }

  /**
   * Score each category based on keyword matches.
   */
  private scoreCategories(input: string): Record<WorkCategoryId, number> {
    const scores: Record<WorkCategoryId, number> = {
      coding: 0,
      drafting: 0,
      automation: 0,
      general: 0,
    };

    for (const [categoryId, patterns] of Object.entries(this.keywordPatterns)) {
      for (const pattern of patterns) {
        if (input.includes(pattern.toLowerCase())) {
          scores[categoryId as WorkCategoryId] += 0.15;
        }
      }
    }

    // Normalize scores to 0-1 range
    const maxPossible = Object.values(this.keywordPatterns).flat().length * 0.15;
    for (const category of Object.keys(scores) as WorkCategoryId[]) {
      scores[category] = Math.min(1, scores[category] / maxPossible);
    }

    return scores;
  }

  /**
   * Find matched keywords for a category.
   */
  private findMatchedKeywords(input: string, category: WorkCategoryId): string[] {
    const patterns = this.keywordPatterns[category] || [];
    return patterns.filter((p) => input.includes(p.toLowerCase()));
  }

  /**
   * Determine the workflow type based on input and category.
   */
  private determineWorkflow(input: string, category: WorkCategoryId): 'react' | 'deep-research' | 'audit-chain' {
    const lowerInput = input.toLowerCase();

    // Deep research indicators
    if (
      lowerInput.includes('research') ||
      lowerInput.includes('investigate') ||
      lowerInput.includes('deep dive') ||
      lowerInput.includes('comprehensive')
    ) {
      return 'deep-research';
    }

    // Audit indicators
    if (
      lowerInput.includes('audit') ||
      lowerInput.includes('review') ||
      lowerInput.includes('analyze') ||
      lowerInput.includes('assess')
    ) {
      return 'audit-chain';
    }

    // Default to react for coding, deep-research for drafting/automation
    if (category === 'coding') {
      return 'react';
    }

    return 'deep-research';
  }

  /**
   * Build an execution prompt for the determined category.
   */
  private buildExecutionPrompt(
    category: WorkCategoryId,
    userInput: string,
    context?: { workspacePath?: string; activeFiles?: string[] },
  ): string {
    let prompt = `You are working in "${category}" mode.\n\n`;

    if (context?.workspacePath) {
      prompt += `Workspace: ${context.workspacePath}\n`;
    }

    if (context?.activeFiles && context.activeFiles.length > 0) {
      prompt += `Active files: ${context.activeFiles.join(', ')}\n`;
    }

    prompt += `\nUser request:\n${userInput}`;

    return prompt;
  }

  /**
   * Build keyword patterns for each category.
   */
  private buildKeywordPatterns(): Record<WorkCategoryId, string[]> {
    return {
      coding: [
        'code', 'implement', 'fix', 'debug', 'function', 'class', 'git', 'commit', 'test', 'build',
        'javascript', 'typescript', 'python', 'react', 'node', 'api', 'database', 'algorithm',
        'component', 'module', 'import', 'export', 'variable', 'constant', 'array', 'object',
        'error', 'bug', 'issue', 'pr', 'pull request', 'branch', 'merge', 'deploy', 'compile',
      ],
      drafting: [
        'write', 'document', 'report', 'email', 'presentation', 'summary', 'article', 'blog',
        'markdown', 'draft', 'compose', 'format', 'style', 'template', 'outline', 'content',
        'documentation', 'manual', 'guide', 'tutorial', 'proposal', 'specification',
      ],
      automation: [
        'automate', 'schedule', 'reminder', 'task', 'cron', 'workflow', 'trigger', 'webhook',
        'pipeline', 'ci/cd', 'continuous integration', 'deployment', 'monitor', 'alert',
        'notification', 'sync', 'export', 'import', 'batch', 'process', 'repeat', 'routine',
      ],
      general: [
        'help', 'what', 'how', 'why', 'search', 'find', 'research', 'learn', 'explain',
        'define', 'describe', 'list', 'compare', 'suggest', 'recommend', 'idea', 'brainstorm',
      ],
    };
  }
}

// Singleton instance
export const categoryRouter = CategoryAwareRouter.getInstance();
