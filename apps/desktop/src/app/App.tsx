import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Settings,
  Pencil,
  Check,
  X,
  Archive,
  Trash2,
  Terminal as TerminalIcon
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { structuredPatch } from "diff";
import { Button } from "@numezis/ui/components/ui/Button";
import { ChatInput } from "@numezis/ui/components/ui/ChatInput";
import { Textarea } from "@numezis/ui/components/ui/Textarea";
import { Toggle } from "@numezis/ui/components/ui/Toggle";
import { ThreadFeed } from "@numezis/ui/components/ui/ThreadFeed";
import { ToolUsePanel, type ToolUseItem, type ToolUseStatus } from "@numezis/ui/components/ui/ToolUsePanel";
import { Terminal } from "@numezis/ui/components/Terminal";

type ActiveView = "app" | "settings";
type SettingsSectionId =
  | "general"
  | "configuration"
  | "personalization"
  | "mcp"
  | "git"
  | "environments"
  | "worktrees"
  | "archived";

type WorkspaceSummary = {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
};

type UserInfo = { id: string; email: string; fullName: string | null };

type AuthState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserInfo | null;
};

type LoginSession = {
  deviceSessionId: string;
  codeVerifier: string;
  startedAt: number;
};

type ChatEvent = {
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

type RenderItem =
  | { type: "event"; event: ChatEvent }
  | { type: "tools"; events: ChatEvent[] };

type ServerAgentEvent = {
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

type DiffHunk = {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
};

type DiffRequest = {
  editId: string;
  filePath: string;
  baseContent: string;
  targetContent: string;
  hunks: DiffHunk[];
};

type PendingEdit = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  createdAt?: string;
  description?: string;
};

type DiffRow = {
  type: "context" | "add" | "remove";
  leftNumber: number | null;
  rightNumber: number | null;
  leftText: string;
  rightText: string;
};

type PreviewLine = {
  line: number;
  text: string;
};

type StreamingState = "idle" | "streaming" | "stopped" | "error";

type WorkspaceInfo = { path: string; name: string };

type ConversationHistoryItem = {
  id: string;
  title: string;
  updatedAt?: string;
  status?: "active" | "archived";
  lastRole?: "user" | "assistant" | "system" | "tool";
};

type ConversationDetail = ConversationHistoryItem & {
  messages?: Array<ServerAgentEvent & { kind?: string; role?: string; content?: string }>;
};

type AgentGraphSummary = {
  id: string;
  name: string;
  description?: string;
  updatedAt?: string;
};

type AgentGraphRunSummary = {
  id: string;
  graphId: string;
  status?: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

type ToolMetadata = {
  name: string;
  description?: string;
};

type LlmConfig = {
  provider?: string;
  [key: string]: unknown;
};

const AUTH_STORAGE_KEY = "numezis.desktop.auth";
const BACKEND_STORAGE_KEY = "numezis.desktop.backendUrl";
const WORKSPACE_STORAGE_KEY = "numezis.desktop.workspace";
const AUTH_LOGIN_TIMEOUT_MS = 6 * 60 * 1000;
const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "configuration", label: "Configuration" },
  { id: "personalization", label: "Personalization" },
  { id: "mcp", label: "MCP servers" },
  { id: "git", label: "Git" },
  { id: "environments", label: "Environments" },
  { id: "worktrees", label: "Worktrees" },
  { id: "archived", label: "Archived threads" }
] as const;

const DEFAULT_BACKEND_URL = "https://app.numezis.com";
const DEV_BACKEND_URL = "http://localhost:3000";

function getDefaultBackendUrl(): string {
  try {
    const env = (import.meta as any)?.env;
    if (env?.VITE_BACKEND_URL && typeof env.VITE_BACKEND_URL === "string") {
      return env.VITE_BACKEND_URL;
    }
    if (env?.DEV) return DEV_BACKEND_URL;
  } catch {
    // ignore env parsing issues
  }
  return DEFAULT_BACKEND_URL;
}


function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeBackendUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  const isLocal =
    trimmed.startsWith("localhost") ||
    trimmed.startsWith("127.0.0.1") ||
    trimmed.startsWith("0.0.0.0") ||
    trimmed.startsWith("[::1]");
  const hasPort = /:\d+/.test(trimmed);
  const scheme = isLocal || hasPort ? "http://" : "https://";
  return `${scheme}${trimmed}`;
}

function loadAuth(): AuthState | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthState | null) {
  if (!auth) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function base64UrlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

const MAX_TOOL_PAYLOAD_CHARS = 8000;
const MAX_TOOL_PREVIEW_CHARS = 160;

function truncatePayload(value: string): string {
  if (value.length <= MAX_TOOL_PAYLOAD_CHARS) return value;
  return `${value.slice(0, MAX_TOOL_PAYLOAD_CHARS)}\n… (truncated)`;
}

function formatMaybeJson(value?: string): string {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return truncatePayload(JSON.stringify(parsed, null, 2));
  } catch {
    return truncatePayload(value);
  }
}

function formatToolPreview(value?: string): string {
  if (!value) return "";
  const formatted = formatMaybeJson(value)
    .replace(/\s+/g, " ")
    .trim();
  if (!formatted) return "";
  if (formatted.length <= MAX_TOOL_PREVIEW_CHARS) return formatted;
  return `${formatted.slice(0, MAX_TOOL_PREVIEW_CHARS)}…`;
}

function buildHunks(editId: string, filePath: string, baseContent: string, targetContent: string): DiffHunk[] {
  const patch = structuredPatch(filePath, filePath, baseContent, targetContent, "", "");
  return patch.hunks.map((hunk, index) => ({
    id: `${editId}-${index}`,
    oldStart: hunk.oldStart,
    oldLines: hunk.oldLines,
    newStart: hunk.newStart,
    newLines: hunk.newLines,
    lines: hunk.lines
  }));
}

function applyHunksToContent(baseContent: string, hunks: DiffHunk[]): string {
  if (hunks.length === 0) return baseContent;
  let lines = baseContent.split("\n");
  const sorted = [...hunks].sort((a, b) => a.oldStart - b.oldStart);
  let offset = 0;

  for (const hunk of sorted) {
    const startIndex = hunk.oldStart - 1 + offset;
    const endIndex = startIndex + hunk.oldLines;
    const replacement: string[] = [];

    for (const line of hunk.lines) {
      if (line.startsWith("\\ No newline")) continue;
      const prefix = line[0];
      const text = line.slice(1);
      if (prefix === " " || prefix === "+") {
        replacement.push(text);
      }
    }

    lines = [...lines.slice(0, startIndex), ...replacement, ...lines.slice(endIndex)];
    offset += replacement.length - hunk.oldLines;
  }

  return lines.join("\n");
}

function buildDiffRows(hunk: DiffHunk): DiffRow[] {
  const rows: DiffRow[] = [];
  let leftLine = hunk.oldStart;
  let rightLine = hunk.newStart;

  for (const line of hunk.lines) {
    if (line.startsWith("\\ No newline")) continue;
    const prefix = line[0];
    const text = line.slice(1);

    if (prefix === " ") {
      rows.push({
        type: "context",
        leftNumber: leftLine++,
        rightNumber: rightLine++,
        leftText: text,
        rightText: text
      });
    } else if (prefix === "-") {
      rows.push({
        type: "remove",
        leftNumber: leftLine++,
        rightNumber: null,
        leftText: text,
        rightText: ""
      });
    } else if (prefix === "+") {
      rows.push({
        type: "add",
        leftNumber: null,
        rightNumber: rightLine++,
        leftText: "",
        rightText: text
      });
    }
  }

  return rows;
}

function getPreviewLines(
  content: string,
  startLine: number,
  lineCount: number,
  context = 5
): PreviewLine[] {
  const lines = content.split("\n");
  const safeStart = Math.max(1, startLine - context);
  const safeEnd = Math.min(lines.length, startLine + Math.max(lineCount, 1) + context);
  const slice = lines.slice(safeStart - 1, safeEnd);
  return slice.map((text, index) => ({
    line: safeStart + index,
    text
  }));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function deriveWorkspaceName(rootPath?: string, fallback?: string) {
  if (fallback) return fallback;
  if (!rootPath) return "Workspace";
  const parts = rootPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || "Workspace";
}

export default function App() {
  const showTrafficLights = !(
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Electron") &&
    /Mac/.test(navigator.platform)
  );
  const [activeView, setActiveView] = useState<ActiveView>("app");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("general");
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [selectedDiffId, setSelectedDiffId] = useState<string | null>(null);
  const [settingsToggles, setSettingsToggles] = useState({
    preventSleep: true,
    requireCmdEnter: true,
    compactDensity: false,
    opaqueBackground: false,
    pointerCursor: true,
    completionNotifications: true,
    permissionNotifications: false
  });
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    const stored = localStorage.getItem(BACKEND_STORAGE_KEY);
    if (stored) {
      try {
        const env = (import.meta as any)?.env;
        if (env?.DEV && stored === DEFAULT_BACKEND_URL) {
          return DEV_BACKEND_URL;
        }
      } catch {
        // ignore env parsing issues
      }
      return stored;
    }
    return getDefaultBackendUrl();
  });
  const [backendConnected, setBackendConnected] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [loginSession, setLoginSession] = useState<LoginSession | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [threads, setThreads] = useState<ConversationHistoryItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(() => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceInfo) : null;
  });
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [input, setInput] = useState("");
  const [conversationEvents, setConversationEvents] = useState<ChatEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>("idle");
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DiffRequest[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("Backend");
  const [modelConfig, setModelConfig] = useState<LlmConfig | null>(null);
  const [graphs, setGraphs] = useState<AgentGraphSummary[]>([]);
  const [graphsLoading, setGraphsLoading] = useState(false);
  const [graphsError, setGraphsError] = useState<string | null>(null);
  const [selectedGraph, setSelectedGraph] = useState<string | null>(null);
  const [graphRuns, setGraphRuns] = useState<AgentGraphRunSummary[]>([]);
  const [graphRunsLoading, setGraphRunsLoading] = useState(false);
  const [graphRunsError, setGraphRunsError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolMetadata[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState<string>("");
  const [editingMessageSaving, setEditingMessageSaving] = useState(false);
  const [editingMessageError, setEditingMessageError] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string>("");
  const [editingThreadSaving, setEditingThreadSaving] = useState(false);
  const [threadActionId, setThreadActionId] = useState<string | null>(null);
  const [selectedHunkId, setSelectedHunkId] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [streamHasEvents, setStreamHasEvents] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamedEventIdsRef = useRef<Set<string>>(new Set());
  const handledEditIdsRef = useRef<Set<string>>(new Set());

  const backendUrlTrimmed = normalizeBackendUrl(backendUrl);
  const backendUrlValid = isValidHttpUrl(backendUrlTrimmed);
  const backendReady = backendUrlValid && backendConnected;

  useEffect(() => {
    localStorage.setItem(BACKEND_STORAGE_KEY, backendUrlTrimmed);
  }, [backendUrlTrimmed]);

  useEffect(() => {
    setConversationId(null);
    setThreads([]);
    setConversationEvents([]);
    setDiffs([]);
    streamedEventIdsRef.current = new Set();
    handledEditIdsRef.current = new Set();
    setStreamingState("idle");
  }, [backendUrlTrimmed, workspace?.path]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationEvents, streamingMessage, diffs]);

  useEffect(() => {
    if (diffs.length === 0) {
      setSelectedDiffId(null);
      return;
    }
    if (!selectedDiffId || !diffs.some((diff) => diff.editId === selectedDiffId)) {
      setSelectedDiffId(diffs[0].editId);
    }
  }, [diffs, selectedDiffId]);

  useEffect(() => {
    const diff = selectedDiffId
      ? diffs.find((entry) => entry.editId === selectedDiffId)
      : diffs[0];
    if (!diff || diff.hunks.length === 0) {
      setSelectedHunkId(null);
      return;
    }
    if (!selectedHunkId || !diff.hunks.some((hunk) => hunk.id === selectedHunkId)) {
      setSelectedHunkId(diff.hunks[0].id);
    }
  }, [diffs, selectedDiffId, selectedHunkId]);

  useEffect(() => {
    if (!workspace) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (!workspace?.path) return;
    window.numezis.setWorkspace(workspace.path).catch(() => undefined);
  }, [workspace?.path]);

  async function probeBackend() {
    if (!backendUrlValid) {
      setBackendConnected(false);
      return;
    }
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/auth/me`, {
        headers: auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : undefined
      });
      setBackendConnected(res.status > 0);
    } catch {
      setBackendConnected(false);
    }
  }

  useEffect(() => {
    void probeBackend();
  }, [backendUrlTrimmed, auth?.accessToken]);

  async function refreshTokens(): Promise<AuthState | null> {
    if (!auth?.refreshToken) return null;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/auth/ide-refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      });
      const data = await res.json();
      if (!data?.success) return null;
      const updated: AuthState = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        user: data.user || auth.user
      };
      setAuth(updated);
      saveAuth(updated);
      return updated;
    } catch {
      return null;
    }
  }

  async function getAccessToken(): Promise<string | null> {
    if (!auth) return null;
    const shouldRefresh = Date.now() > auth.expiresAt - 60_000;
    if (!shouldRefresh) return auth.accessToken;
    const refreshed = await refreshTokens();
    return refreshed?.accessToken ?? null;
  }

  async function loadUser() {
    if (!auth?.accessToken) return;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/auth/me`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const updated = { ...auth, user: data.user ?? auth.user };
        setAuth(updated);
        saveAuth(updated);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (auth?.accessToken) {
      void loadUser();
    }
  }, [auth?.accessToken, backendUrlTrimmed]);

  async function loadGraphs() {
    const token = await getAccessToken();
    if (!token) return;
    try {
      setGraphsLoading(true);
      setGraphsError(null);
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graphs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load graphs (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data?.graphs) ? (data.graphs as AgentGraphSummary[]) : [];
      setGraphs(list);
      if (list.length > 0) {
        const nextSelected = selectedGraph && list.some(graph => graph.id === selectedGraph)
          ? selectedGraph
          : list[0].id;
        setSelectedGraph(nextSelected);
      } else {
        setSelectedGraph(null);
      }
    } catch {
      setGraphsError("Unable to load graphs.");
    } finally {
      setGraphsLoading(false);
    }
  }

  async function loadModel() {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/llm-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const provider = data?.provider ?? "backend";
      const providerConfig = data?.[provider] ?? {};
      const model = providerConfig?.model || providerConfig?.deployment || "Default";
      setModelLabel(model || "Backend");
      setModelConfig(data ?? null);
    } catch {
      // ignore
    }
  }

  async function loadWorkspaceSummary() {
    const token = await getAccessToken();
    if (!token) return;
    setWorkspaceLoading(true);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/workspaces/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load workspace (${res.status})`);
      }
      const data = await res.json();
      const summary = data?.workspace ?? null;
      setWorkspaceSummary(summary);
      if (summary?.rootPath && (!workspace || workspace.path !== summary.rootPath)) {
        setWorkspace({ path: summary.rootPath, name: deriveWorkspaceName(summary.rootPath, summary.name) });
      }
    } catch {
      // ignore for now
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function loadThreads(preferredId?: string) {
    const token = await getAccessToken();
    if (!token) return;
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load threads (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? (data as ConversationHistoryItem[]) : [];
      const active = list.filter((item) => item.status !== "archived");
      setThreads(active);
      if (preferredId && active.some((item) => item.id === preferredId)) {
        setConversationId(preferredId);
      } else if (!conversationId || !active.some((item) => item.id === conversationId)) {
        setConversationId(active[0]?.id ?? null);
      }
    } catch (error) {
      setThreadsError((error as Error)?.message || "Unable to load threads.");
    } finally {
      setThreadsLoading(false);
    }
  }

  async function loadConversation(convoId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setConversationLoading(true);
    setSendError(null);
    setDiffs([]);
    setEditingMessageIndex(null);
    setEditingMessageDraft("");
    setEditingMessageError(null);
    handledEditIdsRef.current = new Set();
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent/${convoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load conversation (${res.status})`);
      }
      const data = (await res.json()) as ConversationDetail;
      const rawMessages = Array.isArray(data?.messages) ? data.messages : [];
      const mapped = rawMessages
        .map((msg, index) => {
          const kindValue = String(msg?.kind ?? msg?.role ?? "").toLowerCase();
          const roleValue = String(msg?.role ?? msg?.kind ?? "").toLowerCase();
          const kind: ChatEvent["kind"] =
            kindValue === "user" || kindValue === "assistant" || kindValue === "tool" || kindValue === "system"
              ? (kindValue as ChatEvent["kind"])
              : "system";
          const content = typeof msg?.content === "string" ? msg.content : "";
          return {
            id: msg?.id,
            kind,
            role: roleValue as ChatEvent["role"],
            content,
            toolName: msg?.toolName,
            toolArgs: typeof msg?.toolArgs === "string" ? msg.toolArgs : msg?.toolArgs ? JSON.stringify(msg.toolArgs) : undefined,
            toolOutput:
              typeof msg?.toolOutput === "string" ? msg.toolOutput : msg?.toolOutput ? JSON.stringify(msg.toolOutput) : undefined,
            toolCallId: msg?.toolCallId,
            timestamp: msg?.timestamp,
            metadata: msg?.metadata,
            thoughts: Array.isArray(msg?.thoughts) ? msg.thoughts : undefined,
            messageIndex: index
          } as ChatEvent;
        })
        .filter((event) => {
          if (event.kind === "system" || event.kind === "tool") return true;
          return Boolean(event.content || event.toolName);
        });
      setConversationEvents(mapped);
    } catch (error) {
      setConversationEvents([]);
      setSendError((error as Error)?.message || "Unable to load conversation.");
    } finally {
      setConversationLoading(false);
    }

    try {
      const refreshed = await getAccessToken();
      if (refreshed) {
        await fetchPendingEdits(convoId, refreshed);
      }
    } catch {
      // ignore
    }
  }

  async function createConversation() {
    if (!backendReady) {
      setSendError("Backend disconnected or invalid. Set a valid Backend URL in Settings.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setSendError("You must sign in to create a thread.");
      return;
    }
    setSendError(null);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: "New thread"
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to create thread (${res.status})`);
      }
      const data = await res.json();
      if (data?.id) {
        setConversationId(data.id);
        setConversationEvents([]);
        setDiffs([]);
        setStreamingMessage(null);
        await loadThreads(data.id);
      }
    } catch (error) {
      setSendError((error as Error)?.message || "Unable to create thread.");
    }
  }

  async function loadGraphRuns(graphId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setGraphRunsLoading(true);
    setGraphRunsError(null);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graph-runs?graphId=${encodeURIComponent(graphId)}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load runs (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data?.runs) ? (data.runs as AgentGraphRunSummary[]) : [];
      setGraphRuns(list);
    } catch (error) {
      setGraphRunsError((error as Error)?.message || "Unable to load runs.");
      setGraphRuns([]);
    } finally {
      setGraphRunsLoading(false);
    }
  }

  async function startGraphRun(graphId: string) {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graphs/${graphId}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to start run (${res.status})`);
      }
      await loadGraphRuns(graphId);
    } catch (error) {
      setGraphRunsError((error as Error)?.message || "Unable to start run.");
    }
  }

  async function loadTools() {
    const token = await getAccessToken();
    if (!token) return;
    setToolsLoading(true);
    setToolsError(null);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/tools/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load tools (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? (data as ToolMetadata[]) : [];
      setTools(list);
    } catch (error) {
      setToolsError((error as Error)?.message || "Unable to load tools.");
      setTools([]);
    } finally {
      setToolsLoading(false);
    }
  }

  useEffect(() => {
    if (!auth?.accessToken || !backendReady) return;
    void loadWorkspaceSummary();
    void loadThreads();
    void loadGraphs();
    void loadModel();
    void loadTools();
  }, [auth?.accessToken, backendUrlTrimmed, backendReady]);

  useEffect(() => {
    if (!auth?.accessToken) return;
    if (!selectedGraph) {
      setGraphRuns([]);
      return;
    }
    void loadGraphRuns(selectedGraph);
  }, [auth?.accessToken, selectedGraph, backendUrlTrimmed]);

  useEffect(() => {
    if (!auth?.accessToken) return;
    if (!conversationId) {
      setConversationEvents([]);
      return;
    }
    if (streaming) return;
    void loadConversation(conversationId);
  }, [auth?.accessToken, conversationId, backendUrlTrimmed, streaming]);

  async function fetchPendingEdits(convoId: string, token: string) {
    if (!workspace?.path) return;
    try {
      const res = await fetch(
        `${backendUrlTrimmed}/api/agent/edits?conversationId=${encodeURIComponent(convoId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const edits = (await res.json()) as PendingEdit[];
      if (!Array.isArray(edits) || edits.length === 0) return;

      const newDiffs: DiffRequest[] = [];

      for (const edit of edits) {
        if (!edit?.id || handledEditIdsRef.current.has(edit.id)) continue;
        if (edit.toolName !== "write_file") {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        const filePath = String((edit.args as any)?.filePath ?? (edit.args as any)?.path ?? "");
        const nextContentRaw = (edit.args as any)?.content;
        const targetContent = typeof nextContentRaw === "string" ? nextContentRaw : "";
        if (!filePath) {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        let baseContent = "";
        try {
          baseContent = await window.numezis.readFile(filePath);
        } catch {
          baseContent = "";
        }

        const normalizedBase = normalizeContent(baseContent);
        const normalizedTarget = normalizeContent(targetContent);

        if (normalizedBase === normalizedTarget) {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        const hunks = buildHunks(edit.id, filePath, normalizedBase, normalizedTarget);
        if (hunks.length === 0) {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        newDiffs.push({
          editId: edit.id,
          filePath,
          baseContent: normalizedBase,
          targetContent: normalizedTarget,
          hunks
        });
      }

      if (newDiffs.length > 0) {
        setDiffs(prev => {
          const existing = new Set(prev.map(d => d.editId));
          const merged = [...prev];
          for (const diff of newDiffs) {
            if (!existing.has(diff.editId)) merged.push(diff);
          }
          return merged;
        });
      }
    } catch {
      // ignore fetch failures
    }
  }

  useEffect(() => {
    if (auth?.accessToken) {
      setLoginPending(false);
      setLoginSession(null);
    }
  }, [auth?.accessToken]);

  useEffect(() => {
    if (editingMessageIndex === null) return;
    const editedEvent = conversationEvents.find((event) => event.messageIndex === editingMessageIndex);
    if (!editedEvent) {
      cancelEditMessage();
    }
  }, [editingMessageIndex, conversationEvents]);

  useEffect(() => {
    const unsubscribe = window.numezis.onAuthLink((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "numezis-code:") return;
        if (parsed.hostname !== "numezis.auth") return;
        const accessToken = parsed.searchParams.get("accessToken");
        const refreshToken = parsed.searchParams.get("refreshToken");
        const expiresAt = Number(parsed.searchParams.get("expiresAt") || 0);
        const userId = parsed.searchParams.get("userId") || "";
        const email = parsed.searchParams.get("email") || "";
        const fullName = parsed.searchParams.get("fullName") || null;

        if (!accessToken || !refreshToken || !expiresAt) {
          return;
        }

        const newAuth: AuthState = {
          accessToken,
          refreshToken,
          expiresAt,
          user: userId && email ? { id: userId, email, fullName } : null
        };
        setAuth(newAuth);
        saveAuth(newAuth);
        setLoginPending(false);
        setLoginSession(null);
        setLoginError(null);
      } catch {
        // ignore invalid deep links
      }
    });

    return () => unsubscribe();
  }, []);

  async function startWebLogin() {
    if (!backendUrlValid) {
      setLoginError("Enter a valid Backend URL first.");
      return;
    }

    setLoginError(null);
    setLoginPending(true);

    const deviceSessionId = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);

    try {
      await fetch(`${backendUrlTrimmed}/api/auth/ide-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSessionId, codeChallenge })
      });
    } catch (error) {
      setLoginError("Failed to initialize login session.");
      setLoginPending(false);
      return;
    }

    setLoginSession({ deviceSessionId, codeVerifier, startedAt: Date.now() });

    const params = new URLSearchParams({
      redirect: "ide",
      deviceSessionId,
      code_challenge: codeChallenge
    });
    const loginUrl = `${backendUrlTrimmed}/auth/login?${params.toString()}`;
    const opened = await window.numezis.openExternal(loginUrl);
    if (!opened) {
      setLoginError("Unable to open browser. Open the portal manually to sign in.");
    }
  }

  useEffect(() => {
    if (!loginSession) return;
    const interval = setInterval(async () => {
      if (Date.now() - loginSession.startedAt > AUTH_LOGIN_TIMEOUT_MS) {
        setLoginError("Sign-in expired. Please try again.");
        setLoginPending(false);
        setLoginSession(null);
        return;
      }
      try {
        const url = new URL(`${backendUrlTrimmed}/api/auth/ide-session`);
        url.searchParams.set("deviceSessionId", loginSession.deviceSessionId);
        url.searchParams.set("code_verifier", loginSession.codeVerifier);
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data?.success && data.accessToken) {
          const newAuth: AuthState = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            user: data.user || null
          };
          setAuth(newAuth);
          saveAuth(newAuth);
          setLoginPending(false);
          setLoginSession(null);
          setLoginError(null);
        } else if (data?.error && !data?.pending) {
          setLoginError(data.error);
          setLoginPending(false);
          setLoginSession(null);
        }
      } catch {
        // ignore polling failures
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loginSession, backendUrlTrimmed]);

  function signOut() {
    setAuth(null);
    saveAuth(null);
    setLoginSession(null);
    setLoginPending(false);
    setStreamingState("idle");
    setConversationId(null);
    setThreads([]);
    setConversationEvents([]);
    setDiffs([]);
    streamedEventIdsRef.current = new Set();
    handledEditIdsRef.current = new Set();
  }

  function startEditMessage(index: number, content: string) {
    setEditingMessageIndex(index);
    setEditingMessageDraft(content);
    setEditingMessageError(null);
  }

  function cancelEditMessage() {
    setEditingMessageIndex(null);
    setEditingMessageDraft("");
    setEditingMessageError(null);
  }

  async function saveEditedMessage() {
    if (editingMessageIndex === null || !conversationId) return;
    const nextContent = editingMessageDraft.trim();
    if (!nextContent) {
      setEditingMessageError("Message content cannot be empty.");
      return;
    }
    setEditingMessageSaving(true);
    setEditingMessageError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");
      const res = await fetch(`${backendUrlTrimmed}/api/agent/update-message`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId,
          index: editingMessageIndex,
          content: nextContent
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to update message (${res.status})`);
      }
      setConversationEvents((prev) =>
        prev.map((msg) =>
          msg.messageIndex === editingMessageIndex ? { ...msg, content: nextContent } : msg
        )
      );
      cancelEditMessage();
    } catch (error) {
      setEditingMessageError((error as Error)?.message || "Unable to update message.");
    } finally {
      setEditingMessageSaving(false);
    }
  }

  function startEditThread(thread: ConversationHistoryItem) {
    setEditingThreadId(thread.id);
    setEditingThreadTitle(thread.title || "");
  }

  function cancelEditThread() {
    setEditingThreadId(null);
    setEditingThreadTitle("");
  }

  async function saveEditedThreadTitle() {
    if (!editingThreadId) return;
    const nextTitle = editingThreadTitle.trim();
    if (!nextTitle) return;
    setEditingThreadSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");
      const res = await fetch(`${backendUrlTrimmed}/api/agent/update-title`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ conversationId: editingThreadId, title: nextTitle })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to update title (${res.status})`);
      }
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === editingThreadId ? { ...thread, title: nextTitle } : thread
        )
      );
      if (conversationId === editingThreadId) {
        // Keep local state aligned when viewing the same thread
        setConversationId(editingThreadId);
      }
      cancelEditThread();
    } catch {
      // Swallow; surface next time through UI state if needed
    } finally {
      setEditingThreadSaving(false);
    }
  }

  async function archiveThread(threadId: string) {
    if (!threadId) return;
    const confirmed = window.confirm("Archive this thread?");
    if (!confirmed) return;
    setThreadActionId(threadId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");
      const res = await fetch(`${backendUrlTrimmed}/api/agent?id=${encodeURIComponent(threadId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to archive thread (${res.status})`);
      }
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      if (conversationId === threadId) {
        setConversationId(null);
        setConversationEvents([]);
        setDiffs([]);
      }
    } catch (error) {
      setSendError((error as Error)?.message ?? "Failed to archive thread.");
    } finally {
      setThreadActionId(null);
    }
  }

  async function deleteThread(threadId: string) {
    if (!threadId) return;
    const confirmed = window.confirm(
      "Delete this thread permanently? This cannot be undone."
    );
    if (!confirmed) return;
    setThreadActionId(threadId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");
      const res = await fetch(
        `${backendUrlTrimmed}/api/agent?id=${encodeURIComponent(threadId)}&permanent=true`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to delete thread (${res.status})`);
      }
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      if (conversationId === threadId) {
        setConversationId(null);
        setConversationEvents([]);
        setDiffs([]);
      }
    } catch (error) {
      setSendError((error as Error)?.message ?? "Failed to delete thread.");
    } finally {
      setThreadActionId(null);
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    if (!backendReady) {
      setSendError("Backend disconnected or invalid. Set a valid Backend URL in Settings.");
      return;
    }

    if (!auth?.accessToken) {
      setSendError("You must sign in to send messages.");
      return;
    }

    setSendError(null);
    setStreaming(true);
    setStreamingState("streaming");
    setStreamingMessage(null);
    setStreamHasEvents(false);
    setConversationEvents(prev => [
      ...prev,
      {
        kind: "user",
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
        local: true
      }
    ]);
    setInput("");

    const token = await getAccessToken();
    if (!token) {
      setSendError("Authentication expired. Please sign in again.");
      setStreaming(false);
      setStreamingState("error");
      return;
    }

    let didAbort = false;
    let didError = false;
    let convoId: string | null = null;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    streamedEventIdsRef.current = new Set();

    const ensureConversationId = async () => {
      if (conversationId) return conversationId;
      const res = await fetch(`${backendUrlTrimmed}/api/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: selectedGraph
            ? `Agent Session (${graphs.find(g => g.id === selectedGraph)?.name ?? "Graph"})`
            : "Agent Session"
        }),
        signal: abortRef.current?.signal
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed to create session (${res.status})`);
      }
      const data = await res.json();
      if (!data?.id) {
        throw new Error("Failed to create session.");
      }
      setConversationId(data.id);
      await loadThreads(data.id);
      return data.id as string;
    };

    try {
      convoId = await ensureConversationId();
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let receivedAnyEvent = false;

        const streamOnce = async () => {
          const response = await fetch(`${backendUrlTrimmed}/api/agent/${convoId}/chat`, {
            method: "POST",
            headers: {
              Accept: "text/event-stream",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              message: trimmed,
              ...(modelConfig?.provider ? { llmProvider: modelConfig.provider } : {}),
              ...(selectedGraph ? { graphId: selectedGraph } : {})
            }),
            signal: abortRef.current?.signal
          });

          if (!response.ok || !response.body) {
            const errText = await response.text().catch(() => "");
            throw new Error(errText || `Request failed: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const appendChatEvent = (chatEvent: ChatEvent, eventId?: string) => {
            const id = eventId ?? chatEvent.id;
            if (id && streamedEventIdsRef.current.has(id)) return;
            if (id) streamedEventIdsRef.current.add(id);
            setConversationEvents((prev) => [...prev, { ...chatEvent, id }]);
            setStreamHasEvents(true);
          };

          const appendAssistantContent = (content: string, eventId?: string, timestamp?: string) => {
            if (!content?.trim()) return;
            appendChatEvent(
              {
                kind: "assistant",
                role: "assistant",
                content,
                timestamp
              },
              eventId
            );
          };

          const handleServerEvent = (event: (ServerAgentEvent & { type?: string } & { error?: string })) => {
            receivedAnyEvent = true;
            if ("error" in event && event.error) {
              didError = true;
              setSendError(event.error);
              return;
            }
            if (event.type === "error" && (event as any).message) {
              didError = true;
              setSendError(String((event as any).message));
              return;
            }
            if (event.type === "diff") {
              const diffEvent = event as any;
              const baseContent = normalizeContent(diffEvent.originalContent);
              const targetContent = normalizeContent(diffEvent.newContent);
              const hunks = buildHunks(diffEvent.editId, diffEvent.filePath, baseContent, targetContent);
              if (hunks.length > 0) {
                setDiffs(prev => [...prev, {
                  editId: diffEvent.editId,
                  filePath: diffEvent.filePath,
                  baseContent,
                  targetContent,
                  hunks
                }]);
              }
              setStreamHasEvents(true);
              return;
            }
            if (event.type === "thinking") {
              appendChatEvent({
                kind: "system",
                role: "system",
                content: "Agent is reasoning...",
                timestamp: new Date().toISOString()
              });
              return;
            }
            if (event.type === "tool_call") {
              const toolArgsRaw = (event as any).args ?? (event as any).toolArgs;
              const toolArgs =
                typeof toolArgsRaw === "string"
                  ? toolArgsRaw
                  : toolArgsRaw
                    ? JSON.stringify(toolArgsRaw)
                    : undefined;
              appendChatEvent({
                kind: "assistant",
                role: "assistant",
                toolName: (event as any).toolName ?? "tool",
                toolArgs,
                toolCallId: (event as any).toolId,
                timestamp: new Date().toISOString()
              });
              return;
            }
            if (event.type === "tool_result") {
              const resultRaw = (event as any).result ?? (event as any).output ?? (event as any).error;
              const toolOutput =
                typeof resultRaw === "string" ? resultRaw : resultRaw ? JSON.stringify(resultRaw) : undefined;
              appendChatEvent({
                kind: "tool",
                role: "tool",
                toolName: (event as any).toolName ?? "tool",
                toolOutput,
                toolCallId: (event as any).toolId,
                timestamp: new Date().toISOString()
              });
              return;
            }
            if (event.type === "message" && (event as any).role === "assistant") {
              appendAssistantContent(String((event as any).content ?? ""), (event as any).id);
              return;
            }
            if (event.kind === "user") {
              // Already appended optimistically on the client.
              setStreamHasEvents(true);
              return;
            }
            if (event.kind === "assistant") {
              if (event.toolName) {
                const toolArgs =
                  typeof event.toolArgs === "string"
                    ? event.toolArgs
                    : event.toolArgs
                      ? JSON.stringify(event.toolArgs)
                      : undefined;
                appendChatEvent({
                  kind: "assistant",
                  role: "assistant",
                  toolName: event.toolName,
                  toolArgs,
                  toolCallId: event.toolCallId,
                  timestamp: event.timestamp,
                  thoughts: Array.isArray(event.thoughts) ? event.thoughts : undefined
                }, event.id);
                return;
              }
              if (typeof event.content === "string") {
                appendAssistantContent(event.content, event.id, event.timestamp);
              }
              return;
            }
            if (event.kind === "tool") {
              const toolOutput =
                typeof event.toolOutput === "string"
                  ? event.toolOutput
                  : event.toolOutput
                    ? JSON.stringify(event.toolOutput)
                    : typeof event.content === "string"
                      ? event.content
                      : undefined;
              appendChatEvent({
                kind: "tool",
                role: "tool",
                toolName: event.toolName,
                toolOutput,
                toolCallId: event.toolCallId,
                timestamp: event.timestamp,
                content: typeof event.content === "string" ? event.content : undefined
              }, event.id);
              return;
            }
            if (event.kind === "system") {
              appendChatEvent({
                kind: "system",
                role: "system",
                content: event.content,
                metadata: event.metadata,
                timestamp: event.timestamp
              }, event.id);
            }
          };

          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const payload = line.replace(/^data:\s*/, "");
                if (payload === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(payload) as ServerAgentEvent | { error?: string };
                  handleServerEvent(parsed);
                } catch {
                  // ignore malformed chunks
                }
              }
            }

            if (buffer.trim().startsWith("data:")) {
              const payload = buffer.replace(/^data:\s*/, "").trim();
              if (payload && payload !== "[DONE]") {
                try {
                  const parsed = JSON.parse(payload) as ServerAgentEvent | { error?: string };
                  handleServerEvent(parsed);
                } catch {
                  // ignore
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        };

        try {
          await streamOnce();
          break;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") {
            didAbort = true;
            throw error;
          }
          if (receivedAnyEvent) {
            throw error;
          }
          if (attempt >= maxAttempts) {
            throw error;
          }
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
          await wait(delay + Math.random() * 250);
        }
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        didError = true;
        setSendError(String(error));
      } else {
        didAbort = true;
      }
    } finally {
      if (didError) {
        setStreamingState("error");
      } else if (didAbort) {
        setStreamingState("stopped");
      } else {
        setStreamingState("idle");
      }
      setStreaming(false);
      setStreamingMessage(null);
      abortRef.current = null;
      if (convoId) {
        await fetchPendingEdits(convoId, token);
      }
      await loadThreads(convoId ?? undefined);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingMessage(null);
    setStreamingState("stopped");
  }

  async function applyAllDiff(diffId: string) {
    const diff = diffs.find(d => d.editId === diffId);
    if (!diff) return;
    if (!workspace) {
      setSendError("Select a workspace before applying diffs.");
      return;
    }
    try {
      await window.numezis.applyFileChange(diff.filePath, diff.targetContent);
      handledEditIdsRef.current.add(diffId);
      setDiffs(prev => prev.filter(d => d.editId !== diffId));
    } catch (error) {
      setSendError(`Failed to apply diff: ${String(error)}`);
    }
  }

  async function applyHunk(diffId: string, hunkId: string) {
    const diff = diffs.find(d => d.editId === diffId);
    const hunk = diff?.hunks.find(h => h.id === hunkId);
    if (!diff || !hunk) return;
    if (!workspace) {
      setSendError("Select a workspace before applying diffs.");
      return;
    }

    const updatedBase = applyHunksToContent(diff.baseContent, [hunk]);
    try {
      await window.numezis.applyFileChange(diff.filePath, updatedBase);
    } catch (error) {
      setSendError(`Failed to apply hunk: ${String(error)}`);
      return;
    }

    const updated = {
      ...diff,
      baseContent: updatedBase,
      hunks: buildHunks(diff.editId, diff.filePath, updatedBase, diff.targetContent)
    };

    setDiffs(prev => {
      if (updated.hunks.length === 0) {
        handledEditIdsRef.current.add(diffId);
        return prev.filter(d => d.editId !== diffId);
      }
      return prev.map(d => (d.editId === diffId ? updated : d));
    });
  }

  function rejectHunk(diffId: string, hunkId: string) {
    const diff = diffs.find(d => d.editId === diffId);
    if (!diff) return;

    const remaining = diff.hunks.filter(h => h.id !== hunkId);
    const updatedTarget = applyHunksToContent(diff.baseContent, remaining);
    const updated = {
      ...diff,
      targetContent: updatedTarget,
      hunks: buildHunks(diff.editId, diff.filePath, diff.baseContent, updatedTarget)
    };

    setDiffs(prev => {
      if (updated.hunks.length === 0) {
        handledEditIdsRef.current.add(diffId);
        return prev.filter(d => d.editId !== diffId);
      }
      return prev.map(d => (d.editId === diffId ? updated : d));
    });
  }

  function rejectAllDiff(diffId: string) {
    handledEditIdsRef.current.add(diffId);
    setDiffs(prev => prev.filter(d => d.editId !== diffId));
  }

  const selectedDiff = selectedDiffId
    ? diffs.find((diff) => diff.editId === selectedDiffId) ?? diffs[0]
    : diffs[0];
  const selectedHunk = selectedDiff?.hunks.find((hunk) => hunk.id === selectedHunkId) ?? selectedDiff?.hunks[0];
  const selectedRows = selectedHunk ? buildDiffRows(selectedHunk) : [];
  const diffTooLarge = selectedRows.length > 160;
  const modelMeta = modelConfig?.provider ? `${modelConfig.provider} · ${modelLabel}` : modelLabel;
  const activeThread = threads.find((thread) => thread.id === conversationId) ?? null;
  const activeThreadTitle = activeThread?.title || (conversationId ? "Untitled" : "New thread");
  const activeThreadUpdated = activeThread?.updatedAt ? formatRelativeTime(activeThread.updatedAt) : "";
  const activeStatus = streaming ? "Running" : "Idle";
  const messageEvents = conversationEvents.filter(
    (event) => event.kind === "user" || (event.kind === "assistant" && !event.toolName)
  );
  const visibleEvents = conversationEvents;
  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let toolBuffer: ChatEvent[] = [];
    const flushTools = () => {
      if (toolBuffer.length > 0) {
        items.push({ type: "tools", events: toolBuffer });
        toolBuffer = [];
      }
    };

    for (const event of visibleEvents) {
      const isToolEvent = (event.kind === "assistant" && Boolean(event.toolName)) || event.kind === "tool";
      if (isToolEvent) {
        toolBuffer.push(event);
        continue;
      }
      flushTools();
      items.push({ type: "event", event });
    }
    flushTools();
    return items;
  }, [visibleEvents]);
  const threadEmptyState = useMemo(() => {
    if (!auth?.accessToken) {
      return <span className="text-text-muted">Sign in to load threads.</span>;
    }
    if (threadsLoading) {
      return <span className="text-text-muted">Loading threads...</span>;
    }
    if (threadsError) {
      return <span className="text-rose-300">{threadsError}</span>;
    }
    return <span className="text-text-muted">No threads yet.</span>;
  }, [auth?.accessToken, threadsLoading, threadsError]);

  const threadItems = useMemo(() => {
    return threads.map((thread) => {
      const isEditing = editingThreadId === thread.id;
      const isBusy = threadActionId === thread.id;
      const meta = thread.updatedAt ? formatRelativeTime(thread.updatedAt) : "";

      const title = isEditing ? (
        <input
          value={editingThreadTitle}
          onChange={(event) => setEditingThreadTitle(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          className="w-full rounded-md border border-border-subtle bg-bg-app px-2 py-1 text-xs text-text-primary"
          placeholder="Thread title"
        />
      ) : (
        <span className="truncate">{thread.title || "Untitled"}</span>
      );

      const actions = isEditing ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void saveEditedThreadTitle();
            }}
            disabled={editingThreadSaving}
            className="rounded-md border border-border-subtle bg-bg-elevated p-1 text-text-primary disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              cancelEditThread();
            }}
            className="rounded-md border border-border-subtle bg-bg-elevated p-1 text-text-secondary"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              startEditThread(thread);
            }}
            disabled={isBusy}
            className="rounded-md border border-transparent p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:border-border-subtle hover:bg-bg-elevated disabled:opacity-40"
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void archiveThread(thread.id);
            }}
            disabled={isBusy}
            className="rounded-md border border-transparent p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:border-border-subtle hover:bg-bg-elevated disabled:opacity-40"
            title="Archive"
          >
            <Archive className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void deleteThread(thread.id);
            }}
            disabled={isBusy}
            className="rounded-md border border-transparent p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:border-border-subtle hover:bg-bg-elevated disabled:opacity-40"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      );

      return {
        id: thread.id,
        title,
        meta,
        status: thread.status === "archived" ? "archived" : conversationId === thread.id ? "active" : "idle",
        actions
      };
    });
  }, [
    threads,
    conversationId,
    editingThreadId,
    editingThreadTitle,
    editingThreadSaving,
    threadActionId,
    startEditThread,
    saveEditedThreadTitle,
    cancelEditThread,
    archiveThread,
    deleteThread
  ]);

  return (
    <div className="flex h-screen flex-col bg-bg-app text-text-primary">
      <header className="flex h-10 items-center border-b border-border-subtle bg-bg-app px-3">
        {showTrafficLights && (
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-rose-500/90" />
            <span className="h-3 w-3 rounded-full bg-amber-500/90" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/90" />
          </div>
        )}
      </header>

      {activeView === "settings" ? (
        <div className="flex flex-1 overflow-hidden bg-bg-app">
          <aside className="flex w-60 flex-col border-r border-border-subtle bg-bg-app px-2 py-3">
            <button
              type="button"
              onClick={() => setActiveView("app")}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to app
            </button>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Settings
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSettingsSection(section.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    activeSettingsSection === section.id
                      ? "bg-state-selected text-text-primary"
                      : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                  }`}
                >
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto px-6 py-4">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Backend</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Backend URL</div>
                      <div className="text-xs text-text-muted">Connect to your Numezis backend.</div>
                    </div>
                    <input
                      value={backendUrl}
                      onChange={(event) => setBackendUrl(event.target.value)}
                      className="w-56 rounded-md border border-border-subtle bg-bg-app px-2 py-1 text-xs text-text-primary"
                      placeholder="https://app.numezis.com"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Connection status</div>
                      <div className="text-xs text-text-muted">Reachability and auth status.</div>
                    </div>
                    <span className={`text-xs ${backendReady ? "text-emerald-400" : "text-rose-300"}`}>
                      {backendReady ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Account</div>
                      <div className="text-xs text-text-muted">
                        {auth?.user?.email ? auth.user.email : "Sign in to access threads and runs."}
                      </div>
                    </div>
                    {auth?.accessToken ? (
                      <Button size="xs" variant="secondary" onClick={signOut}>
                        Sign out
                      </Button>
                    ) : (
                      <Button size="xs" variant="secondary" onClick={startWebLogin} disabled={!backendUrlValid || loginPending}>
                        {loginPending ? "Signing in..." : "Sign in"}
                      </Button>
                    )}
                  </div>
                  {loginError && (
                    <div className="px-3 py-2 text-xs text-rose-300">{loginError}</div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Workspace</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Active workspace</div>
                      <div className="text-xs text-text-muted">
                        {workspaceSummary
                          ? workspaceSummary.name ?? deriveWorkspaceName(workspaceSummary.rootPath)
                          : "Not set"}
                      </div>
                    </div>
                    <span className="text-xs text-text-muted">
                      {workspaceLoading ? "Loading..." : workspaceSummary?.id ?? "No workspace"}
                    </span>
                  </div>
                  <div className="px-3 py-2 text-xs text-text-muted">
                    {workspaceSummary?.rootPath ?? workspace?.path ?? "Configure a workspace in the portal to sync threads."}
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Models</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Default provider</div>
                      <div className="text-xs text-text-muted">Used for new threads.</div>
                    </div>
                    <span className="text-xs text-text-muted">{modelConfig?.provider ?? "Not set"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Model</div>
                      <div className="text-xs text-text-muted">Resolved from provider configuration.</div>
                    </div>
                    <span className="text-xs text-text-muted">{modelLabel}</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Agent graphs</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  {graphsLoading && <div className="px-3 py-2 text-xs text-text-muted">Loading graphs...</div>}
                  {graphsError && <div className="px-3 py-2 text-xs text-rose-300">{graphsError}</div>}
                  {!graphsLoading && !graphsError && graphs.length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-muted">No graphs available.</div>
                  )}
                  {graphs.map((graph) => (
                    <button
                      key={graph.id}
                      type="button"
                      onClick={() => setSelectedGraph(graph.id)}
                      className={`flex items-center justify-between gap-4 px-3 py-2 text-left text-xs ${
                        selectedGraph === graph.id
                          ? "bg-state-selected text-text-primary"
                          : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text-primary">{graph.name}</div>
                        <div className="text-[11px] text-text-muted">{graph.description ?? graph.id}</div>
                      </div>
                      <span className="text-[10px] text-text-muted">{formatRelativeTime(graph.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-text-primary">Runs</h2>
                  {selectedGraph && (
                    <Button size="xs" variant="secondary" onClick={() => startGraphRun(selectedGraph)}>
                      Run graph
                    </Button>
                  )}
                </div>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  {!selectedGraph && (
                    <div className="px-3 py-2 text-xs text-text-muted">Select a graph to see runs.</div>
                  )}
                  {selectedGraph && graphRunsLoading && (
                    <div className="px-3 py-2 text-xs text-text-muted">Loading runs...</div>
                  )}
                  {selectedGraph && graphRunsError && (
                    <div className="px-3 py-2 text-xs text-rose-300">{graphRunsError}</div>
                  )}
                  {selectedGraph && !graphRunsLoading && !graphRunsError && graphRuns.length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-muted">No runs yet.</div>
                  )}
                  {selectedGraph && graphRuns.map((run) => (
                    <div key={run.id} className="flex items-center justify-between gap-4 px-3 py-2 text-xs text-text-secondary">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text-primary">{run.status ?? "UNKNOWN"}</div>
                        <div className="text-[11px] text-text-muted">{run.id}</div>
                      </div>
                      <span className="text-[10px] text-text-muted">{formatDateTime(run.startedAt)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Tools</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  {toolsLoading && <div className="px-3 py-2 text-xs text-text-muted">Loading tools...</div>}
                  {toolsError && <div className="px-3 py-2 text-xs text-rose-300">{toolsError}</div>}
                  {!toolsLoading && !toolsError && tools.length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-muted">No tools available.</div>
                  )}
                  {tools.map((tool) => (
                    <div key={tool.name} className="flex items-center justify-between gap-4 px-3 py-2 text-xs text-text-secondary">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text-primary">{tool.name}</div>
                        <div className="text-[11px] text-text-muted">{tool.description ?? "No description"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">General</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Default open destination</div>
                      <div className="text-xs text-text-muted">Where files and folders open by default.</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="secondary">Workspace</Button>
                      <Button size="xs" variant="ghost">System</Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Thread detail</div>
                      <div className="text-xs text-text-muted">Choose how commands show in threads.</div>
                    </div>
                    <Button size="xs" variant="secondary">Steps with commands</Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Prevent sleep while running</div>
                      <div className="text-xs text-text-muted">Keep your computer awake while the agent runs.</div>
                    </div>
                    <Toggle
                      size="sm"
                      checked={settingsToggles.preventSleep}
                      onChange={(checked) => setSettingsToggles((prev) => ({ ...prev, preventSleep: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Require ⌘+Enter to send long prompts</div>
                      <div className="text-xs text-text-muted">Multiline prompts require ⌘+Enter to send.</div>
                    </div>
                    <Toggle
                      size="sm"
                      checked={settingsToggles.requireCmdEnter}
                      onChange={(checked) => setSettingsToggles((prev) => ({ ...prev, requireCmdEnter: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Follow-up behavior</div>
                      <div className="text-xs text-text-muted">Queue follow-ups or interrupt the current run.</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="secondary">Queue</Button>
                      <Button size="xs" variant="ghost">Interrupt</Button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Appearance</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Theme</div>
                      <div className="text-xs text-text-muted">Match your system or pick a look.</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="ghost">Light</Button>
                      <Button size="xs" variant="ghost">Dark</Button>
                      <Button size="xs" variant="secondary">System</Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Use opaque window background</div>
                      <div className="text-xs text-text-muted">Reduce translucency for focus.</div>
                    </div>
                    <Toggle
                      size="sm"
                      checked={settingsToggles.opaqueBackground}
                      onChange={(checked) => setSettingsToggles((prev) => ({ ...prev, opaqueBackground: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Use pointer cursors</div>
                      <div className="text-xs text-text-muted">Show a pointer over interactive elements.</div>
                    </div>
                    <Toggle
                      size="sm"
                      checked={settingsToggles.pointerCursor}
                      onChange={(checked) => setSettingsToggles((prev) => ({ ...prev, pointerCursor: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Compact density</div>
                      <div className="text-xs text-text-muted">Reduce padding across the interface.</div>
                    </div>
                    <Toggle
                      size="sm"
                      checked={settingsToggles.compactDensity}
                      onChange={(checked) => setSettingsToggles((prev) => ({ ...prev, compactDensity: checked }))}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>
                <div className="border border-border-subtle bg-bg-surface divide-y divide-border-subtle">
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Turn completion notifications</div>
                      <div className="text-xs text-text-muted">Only alert when a run is finished.</div>
                    </div>
                    <Toggle
                      size="sm"
                      checked={settingsToggles.completionNotifications}
                      onChange={(checked) => setSettingsToggles((prev) => ({ ...prev, completionNotifications: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Enable permission notifications</div>
                      <div className="text-xs text-text-muted">Show alerts when permissions are required.</div>
                    </div>
                    <Toggle
                      size="sm"
                      checked={settingsToggles.permissionNotifications}
                      onChange={(checked) => setSettingsToggles((prev) => ({ ...prev, permissionNotifications: checked }))}
                    />
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden bg-bg-app">
          <aside className="flex w-[300px] flex-col border-r border-border-subtle bg-bg-surface px-3 py-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              disabled={!backendReady || !auth?.accessToken}
              onClick={() => {
                abortRef.current?.abort();
                setStreaming(false);
                setStreamingMessage(null);
                setConversationEvents([]);
                setDiffs([]);
                setSendError(null);
                void createConversation();
              }}
            >
              New thread
            </Button>

            <div className="mt-3 min-h-0 flex-1 overflow-hidden">
              <ThreadFeed
                title="Threads"
                items={threadItems}
                activeId={conversationId ?? undefined}
                onSelect={(id) => {
                  if (id === conversationId) return;
                  abortRef.current?.abort();
                  setStreaming(false);
                  setStreamingMessage(null);
                  setDiffs([]);
                  setSendError(null);
                  setConversationId(id);
                }}
                emptyState={threadEmptyState}
                showCount
                showTitle
                className="h-full"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveView("settings")}
              className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col overflow-hidden border-r border-border-subtle">
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <div className="mb-3 flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text-primary">{activeThreadTitle}</div>
                    <div className="text-[10px] text-text-muted">
                      {activeThreadUpdated ? `Updated ${activeThreadUpdated}` : "Ready"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${streaming ? "bg-emerald-400" : "bg-text-muted"}`} />
                    <span>{activeStatus}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {conversationLoading && (
                    <div className="border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted">
                      Loading thread...
                    </div>
                  )}
                  {!conversationLoading && messageEvents.length === 0 && (
                    <div className="border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted">
                      Ask anything to start. The agent will respond here.
                    </div>
                  )}
                  {renderItems.map((item, idx) => {
                    if (item.type === "tools") {
                      const toolItems: ToolUseItem[] = item.events.map((toolEvent, toolIdx) => {
                        const isResult = toolEvent.kind === "tool";
                        const detail = isResult ? toolEvent.toolOutput : toolEvent.toolArgs;
                        const preview = formatToolPreview(detail);
                        const timeLabel = toolEvent.timestamp ? formatRelativeTime(toolEvent.timestamp) : "";
                        let status: ToolUseStatus = "pending";
                        if (isResult) {
                          status = "success";
                        } else if (streaming) {
                          status = "running";
                        }

                        return {
                          id: toolEvent.id ?? `${toolEvent.toolName ?? "tool"}-${toolIdx}`,
                          name: toolEvent.toolName ?? "Tool",
                          detail: preview || undefined,
                          meta: timeLabel || undefined,
                          status
                        };
                      });

                      return (
                        <ToolUsePanel
                          key={`tools-${idx}`}
                          title="Tools"
                          items={toolItems}
                          className="bg-bg-surface"
                        />
                      );
                    }

                    const event = item.event;
                    const isUser = event.kind === "user";
                    const isAssistantMessage = event.kind === "assistant" && !event.toolName;
                    const isSystem = event.kind === "system";
                    const hasMessageIndex = typeof event.messageIndex === "number";
                    const isEditing = hasMessageIndex && event.messageIndex === editingMessageIndex;
                    const timeLabel = event.timestamp ? formatRelativeTime(event.timestamp) : "";

                    if (isSystem) {
                      const tokenUsage =
                        (event.metadata as any)?.type === "token_usage"
                          ? (event.metadata as any)?.tokenUsage
                          : undefined;
                      return (
                        <div key={`${event.id ?? idx}-system`} className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] text-text-muted">
                          <div className="flex items-center justify-between">
                            <span>System</span>
                            <span>{timeLabel}</span>
                          </div>
                          {event.content ? <div className="mt-1 text-text-secondary">{event.content}</div> : null}
                          {tokenUsage ? (
                            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-text-muted">
                              <span>Input: {tokenUsage.totalInputTokens ?? tokenUsage.inputTokens ?? "-"}</span>
                              <span>Output: {tokenUsage.totalOutputTokens ?? tokenUsage.outputTokens ?? "-"}</span>
                              <span>Total: {tokenUsage.totalTokens ?? "-"}</span>
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    if (!isUser && !isAssistantMessage) {
                      return null;
                    }

                    return (
                      <div key={`${event.id ?? idx}-message`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`group w-full max-w-[80%] rounded-lg border px-3 py-2 text-sm ${
                            isUser
                              ? "border-border-subtle bg-transparent"
                              : "border-border-subtle bg-bg-surface"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted">
                            <span className={isUser ? "text-amber-200" : "text-emerald-200"}>
                              {isUser ? "User" : "Agent"}
                            </span>
                            <div className="flex items-center gap-2">
                              {timeLabel ? <span>{timeLabel}</span> : null}
                              {conversationId && !streaming && hasMessageIndex && (
                                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={saveEditedMessage}
                                        disabled={editingMessageSaving}
                                        className="rounded-md border border-border-subtle bg-bg-elevated p-1 text-text-primary disabled:opacity-50"
                                      >
                                        <Check className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditMessage}
                                        className="rounded-md border border-border-subtle bg-bg-elevated p-1 text-text-secondary"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!hasMessageIndex || typeof event.content !== "string") return;
                                        startEditMessage(event.messageIndex, event.content);
                                      }}
                                      className="rounded-md border border-transparent p-1 text-text-muted hover:border-border-subtle hover:bg-bg-elevated"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 min-w-0 leading-relaxed">
                            {isEditing ? (
                              <Textarea
                                value={editingMessageDraft}
                                onChange={(event) => setEditingMessageDraft(event.target.value)}
                                disabled={editingMessageSaving}
                                noResize
                              />
                            ) : isAssistantMessage ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.content ?? ""}</ReactMarkdown>
                            ) : (
                              event.content
                            )}
                          </div>
                          {isEditing && editingMessageError && (
                            <div className="mt-1 text-[10px] text-rose-300">{editingMessageError}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {streaming && !streamHasEvents && (
                    <div className="flex justify-start">
                      <div className="w-full max-w-[80%] rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                        <div className="text-[10px] uppercase tracking-wider text-emerald-200">Agent</div>
                        <div className="mt-1 min-w-0 text-text-muted">Working on it...</div>
                      </div>
                    </div>
                  )}
                  {sendError && (
                    <div className="border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                      {sendError}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              <div className="border-t border-border-subtle bg-bg-surface px-3 py-3">
                <ChatInput
                  value={input}
                  onChange={setInput}
                  onSend={sendMessage}
                  onStop={stopStreaming}
                  sending={streaming}
                  disabled={streaming || !backendReady || !auth?.accessToken}
                  placeholder="Ask for follow-up changes"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  footerLeft={(
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => setTerminalOpen((prev) => !prev)}
                      className="gap-2"
                    >
                      <TerminalIcon className="h-3.5 w-3.5" />
                      {terminalOpen ? "Hide Terminal" : "Terminal"}
                    </Button>
                  )}
                  footerRight={<span className="text-[10px] text-text-muted">{modelMeta}</span>}
                />
              </div>
            </div>

            {terminalOpen && (
              <div className="h-56 border-t border-border-subtle bg-bg-surface">
                <Terminal />
              </div>
            )}
          </main>

          <aside className="flex w-[320px] flex-col border-l border-border-subtle bg-bg-app">
            <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <span>Uncommitted changes</span>
              <button
                type="button"
                onClick={() => setChangesExpanded((prev) => !prev)}
                className="flex items-center gap-1 text-[10px] text-text-muted"
              >
                <span>{diffs.length}</span>
                {changesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            </div>
            {changesExpanded ? (
              <div className="space-y-1 border-b border-border-subtle px-2 py-2">
                {diffs.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-text-muted">No changes yet.</div>
                ) : (
                  diffs.map((diff) => (
                    <button
                      key={diff.editId}
                      type="button"
                      onClick={() => setSelectedDiffId(diff.editId)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                        diff.editId === selectedDiff?.editId
                          ? "bg-state-selected text-text-primary"
                          : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{diff.filePath}</span>
                        <span className="text-[10px] text-text-muted">{diff.hunks.length}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="flex-1 overflow-hidden">
              {!selectedDiff ? (
                <div className="flex h-full items-center justify-center text-xs text-text-muted">
                  Select a file to preview.
                </div>
              ) : (
                <div className="h-full overflow-y-auto px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-text-primary">{selectedDiff.filePath}</div>
                      <div className="text-[10px] text-text-muted">{selectedDiff.hunks.length} changes</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => applyAllDiff(selectedDiff.editId)}
                        disabled={!workspace}
                      >
                        Accept all
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => rejectAllDiff(selectedDiff.editId)}
                      >
                        Reject all
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {selectedDiff.hunks.map((hunk, index) => {
                      const isActive = hunk.id === selectedHunk?.id;
                      return (
                        <div
                          key={hunk.id}
                          className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[10px] ${
                            isActive
                              ? "border-border-strong bg-state-selected text-text-primary"
                              : "border-border-subtle bg-bg-surface text-text-muted"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedHunkId(hunk.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="truncate">Change {index + 1}</span>
                            <span className="text-[9px] text-text-muted">
                              +{hunk.newLines} / -{hunk.oldLines}
                            </span>
                          </button>
                          <div className="flex items-center gap-1">
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => applyHunk(selectedDiff.editId, hunk.id)}
                              disabled={!workspace}
                            >
                              Accept
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => rejectHunk(selectedDiff.editId, hunk.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {diffTooLarge ? (
                    <div className="mt-3 flex items-center justify-center text-xs text-text-muted">
                      Diff is too large to display.
                    </div>
                  ) : selectedHunk ? (
                    <div className="mt-3 border border-border-subtle">
                      {selectedRows.map((row, index) => {
                        const leftCellClass =
                          row.type === "remove" ? "diff-cell-remove" : row.type === "add" ? "diff-cell-empty" : "";
                        const rightCellClass =
                          row.type === "add" ? "diff-cell-add" : row.type === "remove" ? "diff-cell-empty" : "";
                        const leftGutterClass = row.type === "remove" ? "diff-gutter-remove" : "diff-gutter";
                        const rightGutterClass = row.type === "add" ? "diff-gutter-add" : "diff-gutter";
                        const leftSign =
                          row.type === "remove" ? "-" : row.type === "context" ? " " : "";
                        const rightSign =
                          row.type === "add" ? "+" : row.type === "context" ? " " : "";

                        return (
                          <div key={index} className={`diff-row ${row.type}`}>
                            <div className={leftGutterClass}>{row.leftNumber ?? ""}</div>
                            <div className={`diff-cell text-text-primary ${leftCellClass}`}>
                              <div className="diff-cell-content">
                                <span
                                  className={`diff-sign ${
                                    row.type === "remove" ? "diff-sign-remove" : "diff-sign-context"
                                  }`}
                                >
                                  {leftSign}
                                </span>
                                <span className="diff-text">{row.leftText || ""}</span>
                              </div>
                            </div>
                            <div className={rightGutterClass}>{row.rightNumber ?? ""}</div>
                            <div className={`diff-cell text-text-primary ${rightCellClass}`}>
                              <div className="diff-cell-content">
                                <span
                                  className={`diff-sign ${
                                    row.type === "add" ? "diff-sign-add" : "diff-sign-context"
                                  }`}
                                >
                                  {rightSign}
                                </span>
                                <span className="diff-text">{row.rightText || ""}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-text-muted">Select a change to preview.</div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
