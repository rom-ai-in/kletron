// packages/shared/src/customCategories.ts

import { WORK_MODES } from "./workMode";

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
export const CATEGORY_TEMPLATES: Record<
  "code" | "work",
  Omit<CustomWorkCategory, "id" | "createdAt" | "updatedAt">
> = {
  code: {
    name: WORK_MODES.code.name,
    description: WORK_MODES.code.description,
    icon: "💻",
    color: WORK_MODES.code.color,
    systemPrompt: WORK_MODES.code.defaultPrompt,
    availableTools: WORK_MODES.code.availableTools,
    requiredContextTypes: WORK_MODES.code.requiredContextTypes,
    capabilities: WORK_MODES.code.capabilities,
    defaultSkills: ["code-review", "implementation", "testing", "debugging"],
    workspaceSpecific: true,
  },
  work: {
    name: WORK_MODES.work.name,
    description: WORK_MODES.work.description,
    icon: "💼",
    color: WORK_MODES.work.color,
    systemPrompt: WORK_MODES.work.defaultPrompt,
    availableTools: WORK_MODES.work.availableTools,
    requiredContextTypes: WORK_MODES.work.requiredContextTypes,
    capabilities: WORK_MODES.work.capabilities,
    defaultSkills: ["research", "explanation", "brainstorming", "technical-writing"],
    workspaceSpecific: false,
  },
};

/**
 * Generate a unique ID for a custom category
 */
export function generateCustomCategoryId(): string {
  const prefix = "custom";
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
export function validateCustomCategory(category: Partial<CustomWorkCategory>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!category.name?.trim()) {
    errors.push("Name is required");
  }

  if (!category.description?.trim()) {
    errors.push("Description is required");
  }

  if (!category.icon?.trim()) {
    errors.push("Icon is required");
  }

  if (!category.color?.trim()) {
    errors.push("Color is required");
  } else if (!/^#[0-9a-fA-F]{6}$/.test(category.color)) {
    errors.push("Color must be a valid hex color (e.g., #3B82F6)");
  }

  if (!category.systemPrompt?.trim()) {
    errors.push("System prompt is required");
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
