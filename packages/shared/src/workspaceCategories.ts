import { WORK_MODES, type WorkModeId, normalizeToWorkModeId } from "./workMode";

/**
 * CoWork / command-center row shape (UI + agent hints).
 * Canonical tool lists live on WORK_MODES; commonTools mirrors allowlists for discovery.
 */
export interface WorkCategory {
  id: WorkModeId;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultSkills: string[];
  commonTools: string[];
  promptTemplate?: string;
}

function modeToWorkCategory(mode: WorkModeId): WorkCategory {
  const w = WORK_MODES[mode];
  const defaultSkills: Record<WorkModeId, string[]> = {
    code: ["code-review", "implementation", "testing", "debugging"],
    work: ["research", "explanation", "brainstorming", "technical-writing"],
  };
  const icons: Record<WorkModeId, string> = {
    code: "💻",
    work: "💼",
  };
  return {
    id: mode,
    name: w.name,
    description: w.description,
    icon: icons[mode],
    color: w.color,
    defaultSkills: defaultSkills[mode],
    commonTools: w.availableTools,
    promptTemplate: w.defaultPrompt,
  };
}

export const DEFAULT_WORK_CATEGORIES: WorkCategory[] = [
  modeToWorkCategory("code"),
  modeToWorkCategory("work"),
];

export function getCategoryById(id: string): WorkCategory | undefined {
  const mode = normalizeToWorkModeId(id);
  return DEFAULT_WORK_CATEGORIES.find((c) => c.id === mode);
}

export function getAllCategories(): WorkCategory[] {
  return [...DEFAULT_WORK_CATEGORIES];
}

export const CATEGORY_TOOL_GROUPS: Record<
  WorkModeId,
  readonly string[]
> = {
  code: ["file_system", "git", "code_analysis", "testing"],
  work: ["web_research", "document_management", "general_tools"],
};

export const CATEGORY_CONNECTOR_GROUPS: Record<
  WorkModeId,
  readonly string[]
> = {
  code: ["git", "github", "gitlab", "bitbucket"],
  work: ["web_api", "document_storage", "cloud_drive", "data_sources"],
};
