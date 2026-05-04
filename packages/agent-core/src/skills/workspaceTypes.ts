import type { SkillDefinition } from "./types";

export type {
  WorkCategory,
} from "@kletron/shared/workspaceCategories";
export {
  DEFAULT_WORK_CATEGORIES,
  getCategoryById,
  getAllCategories,
} from "@kletron/shared/workspaceCategories";

/**
 * Workspace-specific skill configuration
 */
export interface WorkspaceSkillConfig {
  /** Skill ID */
  id: string;
  /** Workspace ID this config applies to */
  workspaceId: string;
  /** Override for required tools in this workspace */
  requiredTools?: string[];
  /** Override for suggested tools in this workspace */
  suggestedTools?: string[];
  /** Workspace-specific system prompt additions */
  workspacePromptPrefix?: string;
  /** Workspace-specific system prompt additions */
  workspacePromptSuffix?: string;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Enhanced skill definition with workspace awareness
 */
export interface WorkspaceAwareSkill extends SkillDefinition {
  /** Workspace-specific overrides */
  workspaceOverrides?: Record<string, Partial<WorkspaceSkillConfig>>;
  /** Categories this skill belongs to */
  categories?: string[];
}
