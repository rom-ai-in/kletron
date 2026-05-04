// packages/agent-core/src/categoryWorkflowRunner.ts

import type { WorkCategoryId } from '@kletron/shared';
import { DEFAULT_WORK_CATEGORIES, getCategoryById, normalizeToWorkModeId } from '@kletron/shared';
import { categoryPromptEngine } from './categoryPromptEngine';
import { categoryRouter } from './categoryRouter';
import { categoryToolSelector } from './categoryToolSelector';
import type { WorkCategory } from './skills/workspaceTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowRunResult {
  /** The category that was used */
  category: WorkCategoryId;
  /** The system prompt that was used */
  systemPrompt: string;
  /** Available tools for this run */
  availableTools: string[];
  /** Whether the run was successful */
  success: boolean;
  /** Response or error message */
  response?: string;
  errorMessage?: string;
  /** Metadata about the run */
  metadata: {
    /** How the category was determined */
    categoryReason: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Execution time in ms */
    executionTime: number;
  };
}

export interface RunWithCategoryOptions {
  /** User input message */
  userInput: string;
  /** Target category (if known) */
  category?: WorkCategoryId;
  /** Workspace ID for context */
  workspaceId?: string;
  /** Workspace path */
  workspacePath?: string;
  /** Active files in the workspace */
  activeFiles?: Array<{ path: string; content: string }>;
  /** Recent file edits */
  recentEdits?: Array<{ path: string; oldContent: string; newContent: string }>;
  /** Custom system prompt override */
  customSystemPrompt?: string;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// ============================================================================
// CATEGORY WORKFLOW RUNNER
// ============================================================================

export class CategoryWorkflowRunner {
  private static instance: CategoryWorkflowRunner;

  private constructor() {}

  static getInstance(): CategoryWorkflowRunner {
    if (!CategoryWorkflowRunner.instance) {
      CategoryWorkflowRunner.instance = new CategoryWorkflowRunner();
    }
    return CategoryWorkflowRunner.instance;
  }

  /**
   * Run a workflow with an explicit category.
   */
  async runWithCategory(options: RunWithCategoryOptions): Promise<WorkflowRunResult> {
    const startTime = Date.now();
    const {
      userInput,
      category,
      workspaceId,
      workspacePath,
      activeFiles,
      recentEdits,
      customSystemPrompt,
      onProgress,
    } = options;

    // Determine category (always canonical code | work)
    const targetCategory = normalizeToWorkModeId(
      String(category ?? this.determineCategory(userInput)),
    );
    onProgress?.(`Using category: ${targetCategory}`);

    // Get category config
    const categoryConfig = getCategoryById(targetCategory) || DEFAULT_WORK_CATEGORIES.find(c => c.id === targetCategory);
    if (!categoryConfig) {
      return {
        category: targetCategory,
        systemPrompt: '',
        availableTools: [],
        success: false,
        errorMessage: `Unknown category: ${targetCategory}`,
        metadata: {
          categoryReason: 'explicit',
          confidence: 0,
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Get available tools for this category
    const availableTools = categoryToolSelector.getToolsForCategory(targetCategory).map(t => t.name);

    // Build category-specific system prompt
    const promptConfig = categoryPromptEngine.buildPromptForCategory({
      category: targetCategory,
      userInput,
      workspacePath,
      activeFiles,
      recentEdits,
      customSystemPrompt,
      availableTools,
    });

    onProgress?.('Building context...');

    // Execute the workflow (in production, this would call the actual agent)
    // For now, return the configuration that would be used
    return {
      category: targetCategory,
      systemPrompt: promptConfig.systemMessage,
      availableTools,
      success: true,
      response: `Processed in "${categoryConfig.name}" mode with ${availableTools.length} tools.`,
      metadata: {
        categoryReason: category ? 'explicit' : 'auto-detected',
        confidence: category ? 1.0 : 0.8,
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Run a workflow with automatic category detection.
   */
  async runAutoCategory(options: Omit<RunWithCategoryOptions, 'category'>): Promise<WorkflowRunResult> {
    const { userInput, workspacePath, activeFiles, recentEdits, customSystemPrompt, onProgress } = options;

    // Determine category automatically
    const inference = categoryRouter.determineCategory(userInput);
    onProgress?.(`Auto-detected category: ${inference.category} (confidence: ${(inference.confidence * 100).toFixed(0)}%)`);

    return this.runWithCategory({
      ...options,
      category: inference.category,
    });
  }

  /**
   * Determine the appropriate category for a user input.
   */
  determineCategory(input: string, availableCategories?: WorkCategory[]): WorkCategoryId {
    const inference = categoryRouter.determineCategory(input);
    return normalizeToWorkModeId(String(inference.category));
  }

  /**
   * Build a category-specific system prompt.
   */
  buildCategorySystemPrompt(
    category: WorkCategoryId,
    skills?: string[],
    customPrompt?: string,
  ): string {
    const categoryConfig = getCategoryById(category) || DEFAULT_WORK_CATEGORIES.find(c => c.id === category);
    if (!categoryConfig) {
      return 'You are a helpful AI assistant.';
    }

    const basePrompt = categoryConfig.promptTemplate || `You are working in "${categoryConfig.name}" mode.`;
    const rolePrompt = categoryPromptEngine.getCategoryRole(category);

    let prompt = `You are${rolePrompt}\n\n`;

    if (customPrompt) {
      prompt += customPrompt + '\n\n';
    }

    // Add skills context
    if (skills && skills.length > 0) {
      prompt += `**Active Skills:**\n${skills.map(s => `- ${s}`).join('\n')}\n\n`;
    }

    // Add constraints
    const constraints = categoryPromptEngine.getCategoryConstraints(category);
    if (constraints.length > 0) {
      prompt += `**Constraints:**\n${constraints.map(c => `- ${c}`).join('\n')}\n\n`;
    }

    return prompt;
  }

  /**
   * Get the default prompt for a category.
   */
  getCategoryDefaultPrompt(category: WorkCategoryId): string {
    const categoryConfig = getCategoryById(category) || DEFAULT_WORK_CATEGORIES.find(c => c.id === category);
    return categoryConfig?.promptTemplate || 'You are a helpful AI assistant.';
  }

  /**
   * Validate that a category is available.
   */
  isCategoryAvailable(category: WorkCategoryId): boolean {
    const mode = normalizeToWorkModeId(String(category));
    return DEFAULT_WORK_CATEGORIES.some((c) => c.id === mode);
  }

  /**
   * Get all available categories.
   */
  getAvailableCategories(): WorkCategory[] {
    return [...DEFAULT_WORK_CATEGORIES];
  }
}

// Singleton instance
export const categoryWorkflowRunner = CategoryWorkflowRunner.getInstance();
