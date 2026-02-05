import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Send,
  Settings,
  Square
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { structuredPatch } from "diff";
import { Button } from "@numezis/ui/components/ui/Button";
import { Textarea } from "@numezis/ui/components/ui/Textarea";
import { Toggle } from "@numezis/ui/components/ui/Toggle";
import { type ThreadItem } from "@numezis/ui/components/ui/ThreadFeed";

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

type AgentEvent =
  | { type: "message"; role: "assistant" | "user"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool_call"; toolName: string; toolId: string }
  | { type: "tool_result"; toolId: string; result?: unknown; error?: string }
  | { type: "diff"; editId: string; filePath: string; originalContent: string; newContent: string }
  | { type: "error"; message: string };

type ServerAgentEvent = {
  id?: string;
  kind?: "system" | "user" | "assistant" | "tool";
  role?: string;
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolOutput?: string;
  timestamp?: string;
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
  messages?: Array<{ kind?: string; role?: string; content?: string }>;
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

const DEFAULT_THREADS: ThreadItem[] = [
  {
    id: "thread-1",
    title: "Fix vectors page JSX syntax",
    subtitle: "numezis-coder-mcp",
    meta: "4m",
    status: "active",
    badge: "3"
  },
  {
    id: "thread-2",
    title: "Analyze logic failure reasons",
    meta: "41m",
    status: "waiting"
  },
  {
    id: "thread-3",
    title: "Refactor campaign process",
    meta: "37m",
    status: "idle"
  },
  {
    id: "thread-4",
    title: "Polish layout and design",
    meta: "1h",
    status: "idle"
  },
  {
    id: "thread-5",
    title: "Run full checks and deploy",
    meta: "2m",
    status: "waiting"
  },
  {
    id: "thread-6",
    title: "Analyze repo for simplifications",
    meta: "6h",
    status: "idle"
  },
  {
    id: "thread-7",
    title: "Audit configuration defaults",
    meta: "Yesterday",
    status: "idle"
  }
];

function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>("app");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("general");
  const [activeThreadId, setActiveThreadId] = useState<string>(DEFAULT_THREADS[0]?.id ?? "");
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
    return localStorage.getItem(BACKEND_STORAGE_KEY) || "https://app.numezis.com";
  });
  const [backendConnected, setBackendConnected] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [loginSession, setLoginSession] = useState<LoginSession | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(() => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceInfo) : null;
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>("idle");
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DiffRequest[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("Backend");
  const [graphs, setGraphs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGraph, setSelectedGraph] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamedEventIdsRef = useRef<Set<string>>(new Set());
  const handledEditIdsRef = useRef<Set<string>>(new Set());

  const backendUrlTrimmed = backendUrl.trim();
  const backendUrlValid = isValidHttpUrl(backendUrlTrimmed);
  const backendReady = backendUrlValid && backendConnected;

  useEffect(() => {
    localStorage.setItem(BACKEND_STORAGE_KEY, backendUrlTrimmed);
  }, [backendUrlTrimmed]);

  useEffect(() => {
    setConversationId(null);
    streamedEventIdsRef.current = new Set();
    handledEditIdsRef.current = new Set();
    setStreamingState("idle");
  }, [backendUrlTrimmed, workspace?.path]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage, diffs]);

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
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graphs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const list = Array.isArray(data?.graphs) ? data.graphs : [];
      setGraphs(list);
      if (!selectedGraph && list.length > 0) {
        setSelectedGraph(list[0].id);
      }
    } catch {
      // ignore
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
      const model = data?.[provider]?.model || data?.[provider]?.deployment || "Backend";
      setModelLabel(model || "Backend");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!auth?.accessToken) return;
    void loadGraphs();
    void loadModel();
  }, [auth?.accessToken, backendUrlTrimmed]);

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
    streamedEventIdsRef.current = new Set();
    handledEditIdsRef.current = new Set();
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
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    const token = await getAccessToken();
    if (!token) {
      setSendError("Authentication expired. Please sign in again.");
      setStreaming(false);
      setStreamingState("error");
      return;
    }

    let latestAssistantMessage = "";
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
            body: JSON.stringify({ message: trimmed }),
            signal: abortRef.current?.signal
          });

          if (!response.ok || !response.body) {
            const errText = await response.text().catch(() => "");
            throw new Error(errText || `Request failed: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const appendAssistantContent = (content: string, eventId?: string) => {
            if (!content?.trim()) return;
            if (eventId && streamedEventIdsRef.current.has(eventId)) return;
            if (eventId) streamedEventIdsRef.current.add(eventId);
            latestAssistantMessage = latestAssistantMessage
              ? `${latestAssistantMessage}\n\n${content}`
              : content;
            setStreamingMessage(latestAssistantMessage);
          };

          const handleServerEvent = (event: (ServerAgentEvent & Partial<AgentEvent>) | { error?: string }) => {
            receivedAnyEvent = true;
            if ("error" in event && event.error) {
              didError = true;
              setSendError(event.error);
              return;
            }
            if ((event as AgentEvent).type === "error") {
              didError = true;
              setSendError((event as AgentEvent).message);
              return;
            }
            if ((event as AgentEvent).type === "diff") {
              const diffEvent = event as AgentEvent;
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
              return;
            }
            if ((event as AgentEvent).type === "message" && (event as AgentEvent).role === "assistant") {
              appendAssistantContent((event as AgentEvent).content, (event as any).id);
              return;
            }
            if (event.kind === "assistant" && typeof event.content === "string") {
              appendAssistantContent(event.content, event.id);
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
      if (latestAssistantMessage) {
        setMessages(prev => [...prev, { role: "assistant", content: latestAssistantMessage }]);
      }
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

  async function checkForUpdates() {
    try {
      const status = await window.numezis.checkForUpdates();
      setUpdateStatus(status);
    } catch {
      // ignore
    }
  }

  async function restartToUpdate() {
    try {
      await window.numezis.restartToUpdate();
    } catch {
      // ignore
    }
  }

  const selectedDiff = selectedDiffId
    ? diffs.find((diff) => diff.editId === selectedDiffId) ?? diffs[0]
    : diffs[0];
  const selectedHunk = selectedDiff?.hunks[0];
  const selectedRows = selectedHunk ? buildDiffRows(selectedHunk) : [];
  const diffTooLarge = selectedRows.length > 160;

  return (
    <div className="flex h-screen flex-col bg-bg-app text-text-primary">
      <header className="flex h-10 items-center border-b border-border-subtle bg-bg-app px-3">
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-rose-500/90" />
          <span className="h-3 w-3 rounded-full bg-amber-500/90" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/90" />
        </div>
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
          <aside className="flex w-64 flex-col border-r border-border-subtle bg-bg-app px-2 py-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                abortRef.current?.abort();
                setStreaming(false);
                setStreamingMessage(null);
                setConversationId(null);
                setMessages([]);
                setDiffs([]);
                setSendError(null);
              }}
            >
              New thread
            </Button>

            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Threads
            </div>
            <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {DEFAULT_THREADS.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition ${
                    activeThreadId === thread.id
                      ? "bg-state-selected text-text-primary"
                      : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                  }`}
                >
                  <span className="truncate">{thread.title}</span>
                  <span className="text-[10px] text-text-muted">{thread.meta}</span>
                </button>
              ))}
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
              <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {messages.length === 0 && (
                  <div className="border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted">
                    Ask anything to start a thread. The agent will respond here.
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div key={idx} className="flex gap-3 border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center border border-border-subtle bg-bg-elevated text-[10px]">
                      {msg.role === "user" ? "U" : "AI"}
                    </div>
                    <div className="min-w-0 flex-1 leading-relaxed">
                      {msg.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {streamingMessage && (
                  <div className="flex gap-3 border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center border border-border-subtle bg-bg-elevated text-[10px]">
                      AI
                    </div>
                    <div className="min-w-0 flex-1 leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingMessage}</ReactMarkdown>
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
              <div className="border-t border-border-subtle bg-bg-surface px-3 py-3">
                <Textarea
                  placeholder="Ask for follow-up changes"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={streaming}
                  noResize
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">{modelLabel}</span>
                  {streaming ? (
                    <Button variant="secondary" size="sm" onClick={stopStreaming}>
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={sendMessage} disabled={!input.trim() || !backendReady}>
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="h-40 border-t border-border-subtle bg-bg-surface px-3 py-2 font-mono text-[11px] text-text-secondary">
              <div className="text-text-muted">$ npm run dev</div>
              <div>Running on http://localhost:3000</div>
              <div className="text-text-muted">Watching 1 file...</div>
              <div>Compiled successfully</div>
            </div>
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
              ) : diffTooLarge ? (
                <div className="flex h-full items-center justify-center text-xs text-text-muted">
                  Diff is too large to display.
                </div>
              ) : (
                <div className="h-full overflow-y-auto px-2 py-2">
                  <div className="text-xs font-semibold text-text-primary">{selectedDiff.filePath}</div>
                  <div className="mt-2 border border-border-subtle">
                    {selectedRows.map((row, index) => (
                      <div key={index} className={`diff-row ${row.type}`}>
                        <div className="diff-gutter">{row.leftNumber ?? ""}</div>
                        <div className="diff-cell text-text-primary">
                          {row.leftText || ""}
                        </div>
                        <div className="diff-gutter">{row.rightNumber ?? ""}</div>
                        <div className="diff-cell text-text-primary">
                          {row.rightText || ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
