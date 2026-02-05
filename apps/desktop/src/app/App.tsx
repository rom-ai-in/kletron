import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Settings as SettingsIcon,
  User,
  Plug,
  FolderOpen,
  RefreshCw,
  Send,
  Square,
  Github,
  ExternalLink
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type TabId = "agent" | "settings";

type UserInfo = { id: string; email: string; fullName: string | null };

type AuthState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserInfo | null;
};

type DeviceFlow = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  deviceCode: string;
  expiresAt?: number;
  interval?: number;
};

type AgentEvent =
  | { type: "message"; role: "assistant" | "user"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool_call"; toolName: string; toolId: string }
  | { type: "tool_result"; toolId: string; result?: unknown; error?: string }
  | { type: "diff"; editId: string; filePath: string; originalContent: string; newContent: string }
  | { type: "error"; message: string };

type DiffRequest = {
  editId: string;
  filePath: string;
  originalContent: string;
  newContent: string;
};

type WorkspaceInfo = { path: string; name: string };

const AUTH_STORAGE_KEY = "numezis.desktop.auth";
const BACKEND_STORAGE_KEY = "numezis.desktop.backendUrl";
const WORKSPACE_STORAGE_KEY = "numezis.desktop.workspace";

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("agent");
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem(BACKEND_STORAGE_KEY) || "http://localhost:3000";
  });
  const [backendConnected, setBackendConnected] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlow | null>(null);
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(() => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceInfo) : null;
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DiffRequest[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("Backend");
  const [graphs, setGraphs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGraph, setSelectedGraph] = useState<string | null>(null);
  const [cloneInput, setCloneInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const backendUrlTrimmed = backendUrl.trim();
  const backendUrlValid = isValidHttpUrl(backendUrlTrimmed);
  const backendReady = backendUrlValid && backendConnected;

  useEffect(() => {
    localStorage.setItem(BACKEND_STORAGE_KEY, backendUrlTrimmed);
  }, [backendUrlTrimmed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage, diffs]);

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
    let latestAssistantMessage = "";
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/auth/me`, {
        headers: auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : undefined
      });
      setBackendConnected(res.status !== 0);
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

  async function startDeviceLogin() {
    setDeviceMessage(null);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/auth/ide-device/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!data?.success) {
        setDeviceMessage(data?.error || "Failed to start device login");
        return;
      }
      setDeviceFlow({
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        verificationUriComplete: data.verificationUriComplete,
        deviceCode: data.deviceCode,
        expiresAt: data.expiresAt,
        interval: data.interval
      });
    } catch (error) {
      setDeviceMessage("Failed to start device login");
    }
  }

  useEffect(() => {
    if (!deviceFlow) return;
    const intervalSeconds = deviceFlow.interval || 5;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrlTrimmed}/api/auth/ide-device/poll?deviceCode=${deviceFlow.deviceCode}`);
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
          setDeviceFlow(null);
          setDeviceMessage("Signed in successfully.");
        }
      } catch {
        // ignore
      }
    }, intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [deviceFlow, backendUrlTrimmed]);

  function signOut() {
    setAuth(null);
    saveAuth(null);
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
    setStreamingMessage(null);
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    const token = await getAccessToken();
    if (!token) {
      setSendError("Authentication expired. Please sign in again.");
      setStreaming(false);
      return;
    }

    const graphId = selectedGraph || graphs[0]?.id || "default";

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${backendUrlTrimmed}/api/agent/${graphId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: trimmed }),
        signal: abortRef.current.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          try {
            const event = JSON.parse(payload) as AgentEvent;
            if (event.type === "message" && event.role === "assistant") {
              latestAssistantMessage = event.content;
              setStreamingMessage(event.content);
            }
            if (event.type === "diff") {
              setDiffs(prev => [...prev, {
                editId: event.editId,
                filePath: event.filePath,
                originalContent: event.originalContent,
                newContent: event.newContent
              }]);
            }
            if (event.type === "error") {
              setSendError(event.message);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        setSendError(String(error));
      }
    } finally {
      if (latestAssistantMessage) {
        setMessages(prev => [...prev, { role: "assistant", content: latestAssistantMessage }]);
      }
      setStreaming(false);
      setStreamingMessage(null);
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingMessage(null);
  }

  function resolveFilePath(relativePath: string): string {
    if (!workspace?.path) return relativePath;
    return `${workspace.path}/${relativePath}`.replace(/\\/g, \"/\").replace(/\/{2,}/g, \"/\");
  }

  async function applyDiff(diff: DiffRequest) {
    if (!workspace) {
      setSendError("Select a workspace before applying diffs.");
      return;
    }
    try {
      await window.numezis.applyFileChange(diff.filePath, diff.newContent);
      setDiffs(prev => prev.filter(d => d.editId !== diff.editId));
    } catch (error) {
      setSendError(`Failed to apply diff: ${String(error)}`);
    }
  }

  function rejectDiff(diff: DiffRequest) {
    setDiffs(prev => prev.filter(d => d.editId !== diff.editId));
  }

  async function openWorkspace() {
    const selected = await window.numezis.selectWorkspace();
    if (selected) setWorkspace(selected);
  }

  async function cloneRepo() {
    if (!cloneInput.trim()) return;
    try {
      const selected = await window.numezis.gitClone(cloneInput.trim());
      setWorkspace(selected);
      setCloneInput("");
    } catch (error) {
      setSendError(`Clone failed: ${String(error)}`);
    }
  }

  const userDisplay = auth?.user?.fullName || auth?.user?.email || "Guest";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-badge">🧠</div>
          <div>
            <div className="brand-title">Numezis Desktop</div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="tab-group">
            <button className={`icon-btn ${activeTab === "agent" ? "active" : ""}`} onClick={() => setActiveTab("agent")}> <MessageSquare size={16} /> </button>
            <button className={`icon-btn ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}> <SettingsIcon size={16} /> </button>
          </div>
          <button className="secondary-btn" onClick={probeBackend} title="Refresh"> <RefreshCw size={14} /> </button>
          {auth?.accessToken ? (
            <button className="secondary-btn" onClick={signOut}><User size={14} /> Sign out</button>
          ) : (
            <button className="primary-btn" onClick={startDeviceLogin}><Plug size={14} /> Sign in</button>
          )}
        </div>
      </header>

      {!backendReady && (
        <div className="status-banner error">Backend disconnected. Set a valid Backend URL in Settings.</div>
      )}

      {activeTab === "agent" ? (
        <div className="main">
          <section className="chat-column">
            <div className="chat-header">
              <div className="chat-title">Agent</div>
              <div className="helper">{userDisplay}</div>
            </div>
            <div className="chat-body">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role === "user" ? "user" : ""}`}>
                  <div className="message-avatar">{msg.role === "user" ? "U" : "AI"}</div>
                  <div className="message-content">
                    {msg.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {streamingMessage && (
                <div className="message">
                  <div className="message-avatar">AI</div>
                  <div className="message-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingMessage}</ReactMarkdown>
                  </div>
                </div>
              )}
              {sendError && (
                <div className="message">
                  <div className="message-avatar">!</div>
                  <div className="message-content">{sendError}</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="composer">
              <div className="composer-box">
                <textarea
                  placeholder="Ask anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={streaming}
                />
                <div className="composer-actions">
                  <span className="model-badge">{modelLabel}</span>
                  {streaming ? (
                    <button className="send-btn" onClick={stopStreaming} title="Stop"><Square size={14} /></button>
                  ) : (
                    <button className="send-btn" onClick={sendMessage} disabled={!input.trim() || !backendReady}><Send size={14} /></button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-title">Workspace</div>
              <div className="meta-row"><span>Folder</span><span>{workspace?.name || "Not set"}</span></div>
              <div className="meta-row"><span>Status</span><span className={`badge ${backendReady ? "connected" : "disconnected"}`}>{backendReady ? "Connected" : "Disconnected"}</span></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="secondary-btn" onClick={openWorkspace}><FolderOpen size={14} /> Open</button>
                <button className="secondary-btn" onClick={() => window.numezis.openInVSCode(workspace?.path)}><ExternalLink size={14} /> VS Code</button>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-title">Agent</div>
              {graphs.length === 0 ? (
                <div className="helper">No agents available.</div>
              ) : (
                <select
                  className="settings-input"
                  value={selectedGraph || graphs[0]?.id}
                  onChange={(e) => setSelectedGraph(e.target.value)}
                >
                  {graphs.map(graph => (
                    <option key={graph.id} value={graph.id}>{graph.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="sidebar-section">
              <div className="sidebar-title">Pending Diffs</div>
              {diffs.length === 0 ? (
                <div className="helper">No pending changes.</div>
              ) : (
                diffs.map(diff => (
                  <div key={diff.editId} className="diff-card">
                    <h4>{diff.filePath}</h4>
                    <div className="diff-preview">
                      <pre>{diff.originalContent.slice(0, 600)}</pre>
                      <pre>{diff.newContent.slice(0, 600)}</pre>
                    </div>
                    <div className="diff-actions">
                      <button className="primary-btn" onClick={() => applyDiff(diff)}>Apply</button>
                      <button className="secondary-btn" onClick={() => rejectDiff(diff)}>Reject</button>
                      <button className="secondary-btn" onClick={() => window.numezis.openInVSCode(resolveFilePath(diff.filePath))}><ExternalLink size={14} /> VS Code</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="settings">
          <section className="settings-section">
            <h3>Connection</h3>
            <div className="list">
              <div className="meta-row"><span>Backend URL</span><span className={backendUrlValid ? "" : "badge disconnected"}>{backendUrlTrimmed || ""}</span></div>
            </div>
            <input
              className={`settings-input ${backendUrlTrimmed.length > 0 && !backendUrlValid ? "invalid" : ""}`}
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://app.numezis.com"
            />
            {backendUrlTrimmed.length > 0 && !backendUrlValid && (
              <div className="settings-error">Enter a valid http:// or https:// URL.</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="secondary-btn" onClick={probeBackend}><RefreshCw size={14} /> Test</button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Authentication</h3>
            <div className="meta-row"><span>Status</span><span className={`badge ${auth?.accessToken ? "connected" : "disconnected"}`}>{auth?.accessToken ? "Signed in" : "Signed out"}</span></div>
            {auth?.user && <div className="helper">{auth.user.email}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {auth?.accessToken ? (
                <button className="secondary-btn" onClick={signOut}><User size={14} /> Sign out</button>
              ) : (
                <button className="primary-btn" onClick={startDeviceLogin}><Plug size={14} /> Start device login</button>
              )}
              {deviceFlow?.verificationUriComplete && (
                <button className="secondary-btn" onClick={() => window.numezis.openExternal(deviceFlow.verificationUriComplete!)}>Open verification page</button>
              )}
            </div>
            {deviceFlow && (
              <div style={{ marginTop: 12 }}>
                <div className="helper">Enter this code in your browser:</div>
                <div className="meta-row"><span>Code</span><span>{deviceFlow.userCode}</span></div>
              </div>
            )}
            {deviceMessage && <div className="helper">{deviceMessage}</div>}
          </section>

          <section className="settings-section">
            <h3>Workspace</h3>
            <div className="meta-row"><span>Current</span><span>{workspace?.path || "Not set"}</span></div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="secondary-btn" onClick={openWorkspace}><FolderOpen size={14} /> Choose folder</button>
              <button className="secondary-btn" onClick={() => window.numezis.openInVSCode(workspace?.path)}><ExternalLink size={14} /> Open in VS Code</button>
            </div>
          </section>

          <section className="settings-section">
            <h3>GitHub</h3>
            <div className="helper">OAuth is handled through /app. Use your GitHub URL to clone locally.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                className="settings-input"
                placeholder="https://github.com/owner/repo or owner/repo"
                value={cloneInput}
                onChange={(e) => setCloneInput(e.target.value)}
              />
              <button className="primary-btn" onClick={cloneRepo}><Github size={14} /> Clone</button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Portal</h3>
            <div className="helper">Manage billing, models, and teams in the web portal.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="secondary-btn" onClick={() => window.numezis.openExternal(backendUrlTrimmed)}><ExternalLink size={14} /> Open /app</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
