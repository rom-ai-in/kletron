// packages/shared/src/customCategories.ts

import type { WorkCategoryId } from './categoryTypes';

/**
 * Custom work category created by the user.
 * Extends the built-in categories with user-defined configuration.
 */
export interface CustomWorkCategory {
  /** Unique ID for this custom category */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Icon emoji or name */
  icon: string;
  /** Color (hex or CSS color) */
  color: string;
  /** System prompt template for this category */
  systemPrompt: string;
  /** Available MCP tools for this category */
  availableTools: string[];
  /** Required context types */
  requiredContextTypes: string[];
  /** Capabilities */
  capabilities: {
    canEditFiles?: boolean;
    canAccessExternalServices?: boolean;
    canScheduleTasks?: boolean;
    canUseTerminal?: boolean;
  };
  /** Default skills */
  defaultSkills: string[];
  /** Whether this category is workspace-specific */
  workspaceSpecific: boolean;
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Built-in category base config (used as template for custom categories)
 */
export const CATEGORY_TEMPLATES: Record<string, Omit<CustomWorkCategory, 'id' | 'createdAt' | 'updatedAt'>> = {
  coding: {
    name: 'Code Assistant',
    description: 'AI-powered code analysis and generation',
    icon: '💻',
    color: '#3B82F6',
    systemPrompt: 'You are a senior software engineer helping with code tasks. Focus on code quality, best practices, and maintainability.',
    availableTools: ['list_files', 'read_file', 'search_code', 'edit_file', 'execute_bash', 'git_commit', 'git_push'],
    requiredContextTypes: ['repository', 'codebase'],
    capabilities: { canEditFiles: true, canAccessExternalServices: false, canScheduleTasks: false, canUseTerminal: true },
    defaultSkills: ['code-review', 'implementation', 'testing', 'debugging'],
    workspaceSpecific: true,
  },
  drafting: {
    name: 'Document Writer',
    description: 'Create and edit professional documents',
    icon: '✏️',
    color: '#10B981',
    systemPrompt: 'You are a professional technical writer. Create clear, well-structured documentation with proper formatting.',
    availableTools: ['fetch_url', 'web_search', 'read_file', 'write_file'],
    requiredContextTypes: ['document_template'],
    capabilities: { canEditFiles: true, canAccessExternalServices: true, canScheduleTasks: false, canUseTerminal: false },
    defaultSkills: ['technical-writing', 'documentation', 'summarization'],
    workspaceSpecific: false,
  },
  automation: {
    name: 'Workflow Automator',
    description: 'Create automated workflows and follow-ups',
    icon: '⚡',
    color: '#F59E0B',
    systemPrompt: 'You are a productivity automation specialist. Create efficient, reliable automations for repetitive tasks.',
    availableTools: ['execute_bash', 'git_commit', 'schedule_task', 'calendar_events'],
    requiredContextTypes: ['calendar', 'email'],
    capabilities: { canEditFiles: false, canAccessExternalServices: true, canScheduleTasks: true, canUseTerminal: true },
    defaultSkills: ['workflow-design', 'task-automation', 'scheduling'],
    workspaceSpecific: false,
  },
  general: {
    name: 'General Assistant',
    description: 'Open-ended questions and general help',
    icon: '🎯',
    color: '#6B7280',
    systemPrompt: 'You are a helpful AI assistant. Provide accurate, concise answers to user questions.',
    availableTools: ['web_search', 'fetch_url'],
    requiredContextTypes: [],
    capabilities: { canEditFiles: false, canAccessExternalServices: true, canScheduleTasks: false, canUseTerminal: false },
    defaultSkills: ['research', 'explanation', 'brainstorming'],
    workspaceSpecific: false,
  },
};

/**
 * Generate a unique ID for a custom category
 */
export function generateCustomCategoryId(): string {
  const prefix = 'custom';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Create a new custom category from a template
 */
export function createCustomCategory(
  templateKey: keyof typeof CATEGORY_TEMPLATES,
  customName?: string,
): CustomWorkCategory {
  const template = CATEGORY_TEMPLATES[templateKey];
  const now = new Date();
  return {
    ...template,
    id: generateCustomCategoryId(),
    name: customName || template.name,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a custom category from scratch (fully custom)
 */
export function createFullyCustomCategory(
  name: string,
  description: string,
  icon: string,
  color: string,
  systemPrompt: string,
  availableTools: string[] = [],
  defaultSkills: string[] = [],
): CustomWorkCategory {
  const now = new Date();
  return {
    id: generateCustomCategoryId(),
    name,
    description,
    icon,
    color,
    systemPrompt,
    availableTools,
    requiredContextTypes: [],
    capabilities: {},
    defaultSkills,
    workspaceSpecific: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate a custom category configuration
 */
export function validateCustomCategory(category: Partial<CustomWorkCategory>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!category.name?.trim()) {
    errors.push('Name is required');
  }

  if (!category.description?.trim()) {
    errors.push('Description is required');
  }

  if (!category.icon?.trim()) {
    errors.push('Icon is required');
  }

  if (!category.color?.trim()) {
    errors.push('Color is required');
  } else if (!/^#[0-9a-fA-F]{6}$/.test(category.color)) {
    errors.push('Color must be a valid hex color (e.g., #3B82F6)');
  }

  if (!category.systemPrompt?.trim()) {
    errors.push('System prompt is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get all available categories (built-in + custom)
 */
export function getAllCategories(customCategories: CustomWorkCategory[]) {
  const builtIn = Object.entries(CATEGORY_TEMPLATES).map(([id, template]) => ({
    ...template,
    id,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));

  return [...builtIn, ...customCategories];
}
