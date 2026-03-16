// Shared types for the Numezis Desktop application

export type ActiveView = "app" | "settings";
export type SettingsSectionId =
  | "general"
  | "configuration"
  | "personalization"
  | "mcp"
  | "skills"
  | "automations"
  | "graphs"
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

// ─── Chat Types (canonical from @numezis/shared) ─────────────────────────────
// Import shared types so they're available locally, then re-export.
import type {
    ChatEvent as _ChatEvent,
    ChatEventKind as _ChatEventKind,
    RenderItem as _RenderItem,
    ServerAgentEvent as _ServerAgentEvent,
    StreamingState as _StreamingState,
    StreamStatus as _StreamStatus,
    StreamChunk as _StreamChunk,
    ThreadLiveStatus as _ThreadLiveStatus,
    ConversationHistoryItem as _ConversationHistoryItem,
    ConversationDetail as _ConversationDetail,
    Message as _Message,
} from '@numezis/shared/chatTypes';

export type ChatEvent = _ChatEvent;
export type ChatEventKind = _ChatEventKind;
export type RenderItem = _RenderItem;
export type ServerAgentEvent = _ServerAgentEvent;
export type StreamingState = _StreamingState;
export type StreamStatus = _StreamStatus;
export type StreamChunk = _StreamChunk;
export type ThreadLiveStatus = _ThreadLiveStatus;
export type ConversationHistoryItem = _ConversationHistoryItem;
export type ConversationDetail = _ConversationDetail;
export type Message = _Message;

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

// StreamingState re-exported from @numezis/shared/chatTypes above

export type WorkspaceInfo = { path: string; name: string };

// ConversationHistoryItem and ConversationDetail re-exported from @numezis/shared/chatTypes above

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

export type GitFileChange = {
  path: string;
  status: 'modified' | 'created' | 'deleted' | 'renamed' | 'untracked';
  from?: string;
};

export type GitStatusInfo = {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
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

// ─── Command Center Types ────────────────────────────────────────────────────

/** Project-based organization */
export type Project = {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  threads: string[]; // thread IDs
  createdAt?: string;
  updatedAt?: string;
};

/** Extended thread with project association and live status */
// ThreadLiveStatus re-exported from @numezis/shared/chatTypes above

export type ThreadWithStatus = ConversationHistoryItem & {
  projectId?: string;
  liveStatus: ThreadLiveStatus;
};

/** Conversation tab (represents an open thread in the tab bar) */
export type ConversationTab = {
  id: string; // thread ID
  title: string;
  projectId?: string;
  isPinned?: boolean;
  liveStatus?: ThreadLiveStatus;
};

/** Right sidebar context item */
export type ProjectContextItem = {
  id: string;
  type: "file" | "doc" | "variable" | "link";
  label: string;
  path?: string;
  value?: string;
};

/** Slash command definition */
export type SlashCommand = {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
  category?: string;
};

/** Skill definition */
export type Skill = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category?: "design" | "project-management" | "deployment" | "custom";
};

/** Queued follow-up message (sent when agent finishes streaming) */
export type QueuedMessage = {
  id: string;
  text: string;
  createdAt: string;
};

/** Automation definition */
export type Automation = {
  id: string;
  name: string;
  description?: string;
  schedule?: string; // cron expression
  status: "active" | "paused" | "completed" | "failed";
  lastRunAt?: string;
  nextRunAt?: string;
};
