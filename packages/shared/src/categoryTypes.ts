// packages/shared/src/categoryTypes.ts

import type { WorkModeId } from "./workMode";
import { WORK_MODES } from "./workMode";

/** Persisted and API ids: `code` | `work`. Legacy four-way ids may still appear during migration. */
export type WorkCategoryId = WorkModeId | "coding" | "drafting" | "automation" | "general" | string;

export interface WorkCategoryConfig {
  id: WorkCategoryId;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  defaultPrompt: string;
  availableTools: string[]; // MCP tool names
  requiredContextTypes: string[];
  capabilities: {
    canEditFiles?: boolean;
    canAccessExternalServices?: boolean;
    canScheduleTasks?: boolean;
    canUseTerminal?: boolean;
  };
  workspaceSpecific?: boolean;
}

export interface WorkspaceCategoryConfig extends WorkCategoryConfig {
  workspaceId: string;
  customName?: string;
  customTools?: string[];
}

export interface CategoryState {
  currentCategory: WorkCategoryId;
  categoryHistory: WorkCategoryId[];
  lastUsed: Record<WorkCategoryId, Date>;
}

function workModeEntryToBuiltIn(
  mode: WorkModeId,
): Omit<WorkCategoryConfig, "id"> {
  const w = WORK_MODES[mode];
  return {
    name: w.name,
    description: w.description,
    icon: w.icon,
    color: w.color,
    defaultPrompt: w.defaultPrompt,
    availableTools: w.availableTools,
    requiredContextTypes: w.requiredContextTypes,
    capabilities: w.capabilities,
    workspaceSpecific: w.workspaceSpecific,
  };
}

/** Built-in categories (two modes). Prefer importing WORK_MODES for connectors and full metadata. */
export const BUILT_IN_CATEGORIES: Record<WorkModeId, Omit<WorkCategoryConfig, "id">> = {
  code: workModeEntryToBuiltIn("code"),
  work: workModeEntryToBuiltIn("work"),
};
