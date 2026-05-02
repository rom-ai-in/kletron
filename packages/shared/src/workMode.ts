/**
 * Canonical Code vs Work mode contract (single source of truth for UX and agent policy).
 * Legacy four-way category ids map here via normalizeToWorkModeId / LEGACY_CATEGORY_TO_WORK_MODE.
 */

export type WorkModeId = "code" | "work";

export interface WorkModeDefinition {
  id: WorkModeId;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultPrompt: string;
  availableTools: string[];
  requiredContextTypes: string[];
  capabilities: {
    canEditFiles?: boolean;
    canAccessExternalServices?: boolean;
    canScheduleTasks?: boolean;
    canUseTerminal?: boolean;
  };
  /** Integration hints for desktop / connector UI */
  connectors: string[];
  workspaceSpecific?: boolean;
}

/** Map legacy DB/API category ids to the two-mode model */
export const LEGACY_CATEGORY_TO_WORK_MODE: Record<string, WorkModeId> = {
  coding: "code",
  drafting: "work",
  automation: "work",
  general: "work",
  code: "code",
  work: "work",
};

export function normalizeToWorkModeId(raw: string | null | undefined): WorkModeId {
  if (raw == null || raw === "") return "code";
  const direct = raw as WorkModeId;
  if (direct === "code" || direct === "work") return direct;
  return LEGACY_CATEGORY_TO_WORK_MODE[raw] ?? "code";
}

/** Strict lookup: unknown ids (except legacy aliases) return null — use for DB category definitions. */
export function resolveWorkModeOrNull(raw: string | null | undefined): WorkModeId | null {
  if (raw == null || raw === "") return null;
  if (raw === "code" || raw === "work") return raw;
  return LEGACY_CATEGORY_TO_WORK_MODE[raw] ?? null;
}

export function isValidWorkModeId(id: string): id is WorkModeId {
  return id === "code" || id === "work";
}

export const WORK_MODES: Record<WorkModeId, WorkModeDefinition> = {
  code: {
    id: "code",
    name: "Code",
    description: "Repository-first assistance: read and edit code, run terminal commands, use git and dev tools.",
    icon: "code",
    color: "#3B82F6",
    defaultPrompt:
      "You are a senior software engineer helping with code tasks. Focus on code quality, best practices, and maintainability. Respect the workspace boundary and prefer minimal, safe changes.",
    availableTools: [
      "list_files",
      "read_file",
      "search_code",
      "edit_file",
      "execute_bash",
      "git_commit",
      "git_push",
      "str_replace_editor",
    ],
    requiredContextTypes: ["repository", "codebase"],
    capabilities: {
      canEditFiles: true,
      canAccessExternalServices: false,
      canScheduleTasks: false,
      canUseTerminal: true,
    },
    connectors: ["git", "github", "gitlab"],
    workspaceSpecific: true,
  },
  work: {
    id: "work",
    name: "Work",
    description: "Research, writing, planning, and general knowledge tasks—without repo-first or terminal-heavy workflows.",
    icon: "briefcase",
    color: "#6366F1",
    defaultPrompt:
      "You are a thoughtful assistant for general work: clear writing, research, and planning. Do not assume a software engineering task unless the user asks. Prefer concise, well-structured answers.",
    /** Read-only repo discovery is allowed so users can ask “what’s in this workspace?” without switching to Code mode; terminal/git/bash remain Code-only. */
    availableTools: [
      "web_search",
      "fetch_url",
      "read_file",
      "write_file",
      "calculate",
      "list_files",
      "search_code",
      "describe_structure",
      "repo_metrics",
    ],
    requiredContextTypes: [],
    capabilities: {
      canEditFiles: true,
      canAccessExternalServices: true,
      canScheduleTasks: false,
      canUseTerminal: false,
    },
    connectors: ["web_api", "document_storage"],
    workspaceSpecific: false,
  },
};

export function getWorkModeDefinition(mode: WorkModeId): WorkModeDefinition {
  return WORK_MODES[mode];
}
