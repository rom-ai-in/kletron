/**
 * Canonical Code vs Work mode contract (single source of truth for UX and agent policy).
 * Legacy four-way category ids map here via normalizeToWorkModeId / LEGACY_CATEGORY_TO_WORK_MODE.
 */

import { STANDARD_WORKSPACE_BUNDLED_TOOLS } from "./agentBundledTools";

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

/**
 * Work mode = standard bundled toolkit minus terminal/git-read tools, plus research connectors
 * and progressive-disclosure helpers. Keeps Cowork-style parity when STANDARD_WORKSPACE_BUNDLED_TOOLS grows.
 */
const WORK_MODE_STRIPPED_FROM_STANDARD = new Set<string>([
  "execute_bash",
  "git_log",
  "git_diff",
  "git_grep",
  "git_blame",
]);

const WORK_MODE_TOOLS_BEYOND_STANDARD = [
  "fetch_url",
  "web_search",
  "list_available_skills",
  "load_skill",
  "write_todos",
] as const;

function buildWorkModeToolAllowlist(): string[] {
  const fromStandard = STANDARD_WORKSPACE_BUNDLED_TOOLS.filter(
    (t) => !WORK_MODE_STRIPPED_FROM_STANDARD.has(t)
  );
  const merged = new Set<string>([...fromStandard, ...WORK_MODE_TOOLS_BEYOND_STANDARD]);
  return Array.from(merged).sort();
}

/** Exported for policy (`toolApprovalPolicy`) and tests. */
export const WORK_MODE_TOOL_ALLOWLIST: string[] = buildWorkModeToolAllowlist();

export const WORK_MODES: Record<WorkModeId, WorkModeDefinition> = {
  code: {
    id: "code",
    name: "Code",
    description: "Repository-first assistance: read and edit code, run terminal commands, use git and dev tools.",
    icon: "code",
    color: "#3B82F6",
    defaultPrompt:
      "You are a senior software engineer. Prioritize correctness and evidence from the repo: search and read enough to be sure before changing code. Prefer minimal, safe diffs, but do not skip investigation to save time.",
    /** Full standard bundled toolkit (repo read/write, bash, git reads, semantic search). */
    availableTools: [...STANDARD_WORKSPACE_BUNDLED_TOOLS],
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
      "You are a thorough assistant for general work: research, writing, and planning grounded in workspace files. Use search and multiple reads when the answer could span documents; cite paths. When saving material on disk, use write_file or str_replace_editor with paths relative to the workspace root.",
    /** Cowork-style surface: files + research connectors; no terminal or git CLI tools. */
    availableTools: WORK_MODE_TOOL_ALLOWLIST,
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
