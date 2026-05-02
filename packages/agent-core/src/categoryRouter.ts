// packages/agent-core/src/categoryRouter.ts

import type { WorkCategoryId, WorkModeId } from "@kletron/shared";
import { DEFAULT_WORK_CATEGORIES, normalizeToWorkModeId, WORK_MODES } from "@kletron/shared";

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
  workflow: "react" | "deep-research" | "audit-chain";
}

// ============================================================================
// CATEGORY AWARE ROUTER
// ============================================================================

export class CategoryAwareRouter {
  private static instance: CategoryAwareRouter;
  private currentCategory: WorkModeId = "code";
  private keywordPatterns: Record<WorkModeId, string[]>;

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
      this.currentCategory = normalizeToWorkModeId(String(categoryId));
    }
  }

  /**
   * Determine the appropriate category for a user input.
   * Uses keyword-based inference with confidence scoring (code vs work).
   */
  determineCategory(userInput: string): CategoryInferenceResult {
    const input = userInput.toLowerCase();

    const explicitMatch = this.findExplicitCategoryMention(input);
    if (explicitMatch) {
      return {
        category: explicitMatch,
        confidence: 0.95,
        reason: "explicit_mention",
        matchedKeywords: [explicitMatch],
      };
    }

    const scores = this.scoreCategories(input);
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topCategory, topScore] = sorted[0] || ["work", 0];
    const secondScore = sorted[1]?.[1] ?? 0;

    // Pick a winner when keyword evidence favors one mode (scores are 0–1 per mode).
    // Threshold ~0.12 so a single strong keyword in a medium-sized list still registers (e.g. "Write …").
    if (topScore > secondScore && topScore >= 0.12) {
      const matchedKeywords = this.findMatchedKeywords(input, topCategory as WorkModeId);
      return {
        category: topCategory as WorkCategoryId,
        confidence: Math.min(0.95, 0.45 + topScore * 0.5),
        reason: `content_analysis(${topScore.toFixed(2)})`,
        matchedKeywords,
      };
    }

    return {
      category: this.currentCategory,
      confidence: 0.3,
      reason: "default_fallback",
      matchedKeywords: [],
    };
  }

  /**
   * Build an execution plan for a user input.
   */
  buildExecutionPlan(userInput: string, context?: { workspacePath?: string; activeFiles?: string[] }): ExecutionPlan {
    const inference = this.determineCategory(userInput);
    const category = normalizeToWorkModeId(String(inference.category));

    const categoryConfig = DEFAULT_WORK_CATEGORIES.find((c) => c.id === category);
    const wm = WORK_MODES[category];
    const config = categoryConfig
      ? {
          name: categoryConfig.name,
          description: categoryConfig.description,
          availableTools: categoryConfig.commonTools,
          requiredContextTypes: wm.requiredContextTypes,
          capabilities: {
            canEditFiles: !!wm.capabilities.canEditFiles,
            canAccessExternalServices: !!wm.capabilities.canAccessExternalServices,
            canScheduleTasks: !!wm.capabilities.canScheduleTasks,
            canUseTerminal: !!wm.capabilities.canUseTerminal,
          },
        }
      : {
          name: "Work",
          description: "General work assistance",
          availableTools: WORK_MODES.work.availableTools,
          requiredContextTypes: [],
          capabilities: {},
        };

    const workflow = this.determineWorkflow(userInput, category);
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
  private findExplicitCategoryMention(input: string): WorkModeId | null {
    const codeHints = ["code mode", "coding mode", "programming mode", "developer mode", "repo mode"];
    const workHints = ["work mode", "cowork", "writing mode", "research mode"];

    for (const h of codeHints) {
      if (input.includes(h)) return "code";
    }
    for (const h of workHints) {
      if (input.includes(h)) return "work";
    }

    return null;
  }

  /**
   * Score code vs work from keyword matches (per-mode density so prose can beat silence).
   */
  private scoreCategories(input: string): Record<WorkModeId, number> {
    const scores: Record<WorkModeId, number> = { code: 0, work: 0 };

    for (const mode of Object.keys(this.keywordPatterns) as WorkModeId[]) {
      const patterns = this.keywordPatterns[mode];
      let hits = 0;
      for (const pattern of patterns) {
        if (input.includes(pattern.toLowerCase())) {
          hits += 1;
        }
      }
      const denom = Math.max(1, patterns.length);
      scores[mode] = Math.min(1, (hits / denom) * 3);
    }

    return scores;
  }

  private findMatchedKeywords(input: string, category: WorkModeId): string[] {
    const patterns = this.keywordPatterns[category] || [];
    return patterns.filter((p) => input.includes(p.toLowerCase()));
  }

  private determineWorkflow(input: string, category: WorkModeId): "react" | "deep-research" | "audit-chain" {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes("research") ||
      lowerInput.includes("investigate") ||
      lowerInput.includes("deep dive") ||
      lowerInput.includes("comprehensive")
    ) {
      return "deep-research";
    }

    if (
      lowerInput.includes("audit") ||
      lowerInput.includes("review") ||
      lowerInput.includes("analyze") ||
      lowerInput.includes("assess")
    ) {
      return "audit-chain";
    }

    if (category === "code") {
      return "react";
    }

    return "deep-research";
  }

  private buildExecutionPrompt(
    category: WorkModeId,
    userInput: string,
    context?: { workspacePath?: string; activeFiles?: string[] },
  ): string {
    let prompt = `You are working in "${category}" mode.\n\n`;

    if (context?.workspacePath) {
      prompt += `Workspace: ${context.workspacePath}\n`;
    }

    if (context?.activeFiles && context.activeFiles.length > 0) {
      prompt += `Active files: ${context.activeFiles.join(", ")}\n`;
    }

    prompt += `\nUser request:\n${userInput}`;

    return prompt;
  }

  /**
   * Code-oriented vs general work-oriented keyword patterns.
   */
  private buildKeywordPatterns(): Record<WorkModeId, string[]> {
    return {
      code: [
        "code",
        "implement",
        "fix",
        "debug",
        "function",
        "class",
        "git",
        "commit",
        "test",
        "build",
        "javascript",
        "typescript",
        "python",
        "react",
        "node",
        "api",
        "database",
        "algorithm",
        "component",
        "module",
        "import",
        "export",
        "refactor",
        "bug",
        "pr",
        "pull request",
        "branch",
        "merge",
        "deploy",
        "compile",
        "terminal",
        "bash",
      ],
      work: [
        "write",
        "document",
        "report",
        "email",
        "presentation",
        "summary",
        "article",
        "blog",
        "draft",
        "research",
        "help",
        "what",
        "how",
        "why",
        "explain",
        "plan",
        "meeting",
        "notes",
        "automate",
        "schedule",
        "workflow",
        "brainstorm",
      ],
    };
  }
}

export const categoryRouter = CategoryAwareRouter.getInstance();
