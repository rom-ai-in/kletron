// packages/agent-core/src/categoryToolSelector.ts

import type { WorkCategoryId, WorkModeId } from '@kletron/shared';
import { DEFAULT_WORK_CATEGORIES, CATEGORY_TOOL_GROUPS, normalizeToWorkModeId } from '@kletron/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface CategoryToolConfig {
  /** Tool name (must match MCP tool name) */
  name: string;
  /** Tool description */
  description: string;
  /** Tool parameters schema */
  parameters: Record<string, unknown>;
  /** Whether the tool can be called automatically (no approval needed) */
  autoExecute: boolean;
  /** Category this tool belongs to */
  category: WorkCategoryId;
}

// ============================================================================
// CATEGORY TOOL SELECTOR
// ============================================================================

export class CategorySpecificToolSelector {
  private static instance: CategorySpecificToolSelector;

  private constructor() {}

  static getInstance(): CategorySpecificToolSelector {
    if (!CategorySpecificToolSelector.instance) {
      CategorySpecificToolSelector.instance = new CategorySpecificToolSelector();
    }
    return CategorySpecificToolSelector.instance;
  }

  /**
   * Get all tools available for a given category.
   */
  getToolsForCategory(categoryId: WorkCategoryId): CategoryToolConfig[] {
    const mode = normalizeToWorkModeId(String(categoryId));
    const categoryConfig = DEFAULT_WORK_CATEGORIES.find((c) => c.id === mode);
    if (!categoryConfig) {
      return [];
    }

    // Get base tools for the category
    const baseTools = this.getBaseTools(mode);

    // Get group-specific tools
    const groupTools = this.getGroupTools(mode);

    // Merge and deduplicate
    const toolMap = new Map<string, CategoryToolConfig>();
    for (const tool of [...baseTools, ...groupTools]) {
      toolMap.set(tool.name, tool);
    }

    return Array.from(toolMap.values());
  }

  /**
   * Get tools by group for a category.
   */
  getToolsForGroup(categoryId: WorkCategoryId, group: string): CategoryToolConfig[] {
    const mode = normalizeToWorkModeId(String(categoryId));
    const tools = this.getToolsForCategory(mode);
    return tools.filter((t) => t.category === mode && this.isToolInGroup(t.name, group, mode));
  }

  /**
   * Check if a tool is available for a category.
   */
  isToolAvailableForCategory(toolName: string, categoryId: WorkCategoryId): boolean {
    const tools = this.getToolsForCategory(categoryId);
    return tools.some((t) => t.name === toolName);
  }

  /**
   * Get base tools for a category (from DEFAULT_WORK_CATEGORIES.commonTools).
   */
  private getBaseTools(mode: WorkModeId): CategoryToolConfig[] {
    const categoryConfig = DEFAULT_WORK_CATEGORIES.find((c) => c.id === mode);
    if (!categoryConfig || !categoryConfig.commonTools) {
      return [];
    }

    return categoryConfig.commonTools.map((toolName) => ({
      name: toolName,
      description: `${toolName} - Available in ${mode} mode`,
      parameters: {},
      autoExecute: this.isAutoExecute(toolName, mode),
      category: mode,
    }));
  }

  /**
   * Get group-specific tools for a category.
   */
  private getGroupTools(mode: WorkModeId): CategoryToolConfig[] {
    const groups = CATEGORY_TOOL_GROUPS[mode];
    if (!groups) {
      return [];
    }

    const allTools = this.getAllMcpTools();
    return allTools.filter((tool) => groups.includes(tool.group));
  }

  /**
   * Check if a tool is in a specific group.
   */
  private isToolInGroup(toolName: string, group: string, mode: WorkModeId): boolean {
    const groupTools = this.getGroupTools(mode);
    return groupTools.some((t) => t.name === toolName);
  }

  /**
   * Check if a tool can be auto-executed (no approval needed).
   */
  private isAutoExecute(toolName: string, mode: WorkModeId): boolean {
    // Read-only tools are always auto-executable
    const readOnlyTools = ['list_files', 'read_file', 'read_file_range', 'search_code', 'git_log', 'git_diff', 'git_blame', 'git_grep'];
    if (readOnlyTools.includes(toolName)) {
      return true;
    }

    // Write tools require approval
    const writeTools = ['write_file', 'str_replace_editor'];
    if (writeTools.includes(toolName)) {
      return false;
    }

    // Execute tools require approval
    const executeTools = ['execute_bash'];
    if (executeTools.includes(toolName)) {
      return false;
    }

    return true;
  }

  /**
   * Get all MCP tools with their group information.
   *
   * IMPORTANT: This list MUST stay in sync with the names exported by
   * `allMcpTools` (in `tools/mcpTools.ts`) plus the always-on Kletron admin
   * pack (`KLETRON_ADMIN_TOOL_NAMES`). Names that don't exist in either set
   * are dead references and should not be added here. The vitest guard
   * `categoryToolSelector.test.ts` enforces this invariant.
   */
  private getAllMcpTools(): Array<{ name: string; group: string }> {
    return [
      // File system tools
      { name: 'list_files', group: 'file_system' },
      { name: 'glob_files', group: 'file_system' },
      { name: 'read_file', group: 'file_system' },
      { name: 'read_file_range', group: 'file_system' },
      { name: 'write_file', group: 'file_system' },
      { name: 'str_replace_editor', group: 'file_system' },

      // Git tools
      { name: 'git_log', group: 'git' },
      { name: 'git_diff', group: 'git' },
      { name: 'git_blame', group: 'git' },
      { name: 'git_grep', group: 'git' },

      // Code analysis tools
      { name: 'search_code', group: 'code_analysis' },
      { name: 'semantic_code_search', group: 'code_analysis' },
      { name: 'structural_search', group: 'code_analysis' },
      { name: 'symbols_list', group: 'code_analysis' },
      { name: 'find_symbol', group: 'code_analysis' },
      { name: 'go_to_definition', group: 'code_analysis' },
      { name: 'references', group: 'code_analysis' },
      { name: 'repo_metrics', group: 'code_analysis' },
      { name: 'describe_structure', group: 'code_analysis' },
      { name: 'dependency_info', group: 'code_analysis' },
      { name: 'todo_search', group: 'code_analysis' },
      { name: 'locate_ui_feature', group: 'code_analysis' },

      // Web tools
      { name: 'web_search', group: 'web_research' },
      { name: 'fetch_url', group: 'web_research' },

      // GitHub tools
      { name: 'github_api', group: 'git' },

      // Execution tools
      { name: 'execute_bash', group: 'task_execution' },

      // General tools
      { name: 'output_format', group: 'general_tools' },
      { name: 'bootstrap_context', group: 'general_tools' },
      { name: 'list_all_skills', group: 'general_tools' },
      { name: 'list_skills', group: 'general_tools' },
    ];
  }
}

// Singleton instance
export const categoryToolSelector = CategorySpecificToolSelector.getInstance();
