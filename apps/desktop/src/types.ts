// Shared types for the Numezis Desktop application

export type ActiveView = "app" | "settings";
export type SettingsSectionId =
  | "general"
  | "configuration"
  | "personalization"
  | "mcp"
  | "git"
  | "environments"
  | "worktrees"
  | "archived";

export type WorkspaceSummary = {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
};

export type UserInfo = { id: string; email: string; fullName: string | null };

export type AuthState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserInfo | null;
};

export type LoginSession = {
  deviceSessionId: string;
  codeVerifier: string;
  startedAt: number;
};

export type ChatEvent = {
  id?: string;
  kind: "user" | "assistant" | "tool" | "system" | "error";
  role?: "user" | "assistant" | "tool" | "system";
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolOutput?: string;
  toolCallId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  thoughts?: string[];
  messageIndex?: number | null;
  local?: boolean;
};

export type RenderItem =
  | { type: "event"; event: ChatEvent }
  | { type: "tools"; events: ChatEvent[] };

export type ServerAgentEvent = {
  id?: string;
  kind?: "system" | "user" | "assistant" | "tool";
  role?: string;
  content?: string;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: string;
  toolOutput?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  thoughts?: string[];
};

export type DiffHunk = {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
};

export type DiffRequest = {
  editId: string;
  filePath: string;
  baseContent: string;
  targetContent: string;
  hunks: DiffHunk[];
};

export type PendingEdit = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  createdAt?: string;
  description?: string;
};

export type DiffRow = {
  type: "context" | "add" | "remove";
  leftNumber: number | null;
  rightNumber: number | null;
  leftText: string;
  rightText: string;
};

export type PreviewLine = {
  line: number;
  text: string;
};

export type StreamingState = "idle" | "streaming" | "stopped" | "error";

export type WorkspaceInfo = { path: string; name: string };

export type ConversationHistoryItem = {
  id: string;
  title: string;
  updatedAt?: string;
  status?: "active" | "archived";
  lastRole?: "user" | "assistant" | "system" | "tool";
};

export type ConversationDetail = ConversationHistoryItem & {
  messages?: Array<ServerAgentEvent & { kind?: string; role?: string; content?: string }>;
};

export type AgentGraphSummary = {
  id: string;
  name: string;
  description?: string;
  updatedAt?: string;
};

export type AgentGraphRunSummary = {
  id: string;
  graphId: string;
  status?: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

export type ToolMetadata = {
  name: string;
  description?: string;
};

export type LlmConfig = {
  provider?: string;
  [key: string]: unknown;
};

export type SettingsToggles = {
  preventSleep: boolean;
  requireCmdEnter: boolean;
  compactDensity: boolean;
  opaqueBackground: boolean;
  pointerCursor: boolean;
  completionNotifications: boolean;
  permissionNotifications: boolean;
};

// File editor types
export type OpenFile = {
  path: string;
  filename: string;
  content: string;
  originalContent: string;
  language: string;
};

export type GitStatusInfo = {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
};

export type SidePanelId = "explorer" | "search" | "git" | "ai" | "settings";

export type LLMProvider = {
  id: string;
  label: string;
  models: Array<{ id: string; label: string }>;
  connected: boolean;
};

export type MCPServer = {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
};

export type EnvVariable = {
  key: string;
  value: string;
  secret?: boolean;
};

export type Worktree = {
  path: string;
  branch: string;
  isMain: boolean;
};
