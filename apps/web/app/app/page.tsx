"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Badge,
  Panel,
  EmptyState,
  LoadingState,
} from "@numezis/ui/components/design-system";
import { TokenUsageDisplay, type TokenUsageSummary } from "@numezis/ui/components/Agent/metrics";
import { useLlmHealth } from "@numezis/ui/hooks/useLlmHealth";
import { useWorkspace } from "@numezis/ui/context/WorkspaceContext";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  FileCode,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Scan,
  Settings,
  Sparkles,
  TerminalSquare,
  Wand2,
} from "lucide-react";

const DEFAULT_TITLE = "Explore Session";
const STORAGE_KEY = "workbench-active-conversation";

const LAUNCHPAD = [
  {
    title: "Deep Agent",
    description: "Run multi-step agents with live traces and tool calls.",
    href: "/app/agent",
    icon: Sparkles,
  },
  {
    title: "Explore",
    description: "Start or resume exploration sessions.",
    href: "/app/agent",
    icon: TerminalSquare,
  },
  {
    title: "Workbench",
    description: "Build prompts, inspect diffs, and iterate on tasks.",
    href: "/app/workbench",
    icon: Wand2,
  },
  {
    title: "Vectors",
    description: "Index, search, and monitor your knowledge base.",
    href: "/app/vectors",
    icon: Database,
  },
  {
    title: "Changes",
    description: "Review and compare code changes quickly.",
    href: "/app/changes",
    icon: FileCode,
  },
  {
    title: "Config",
    description: "Manage LLM providers, embeddings, and workspace settings.",
    href: "/app/config",
    icon: Settings,
  },
];

type ConversationHistoryItem = {
  id: string;
  title: string;
  updatedAt: string;
  status?: "active" | "archived";
  lastRole?: "user" | "assistant" | "system" | "tool";
};

type AgentGraphSummary = {
  _id: string;
  name: string;
  description?: string;
};

type AgentGraphRunSummary = {
  id: string;
  graphId: string;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
};


type VectorStatus = {
  isIndexing: boolean;
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  lastIndexedAt?: string;
  currentFile?: string;
  errors: string[];
  autoIndexEnabled?: boolean;
  schedulerStatus?: "idle" | "running" | "pending";
};

type LlmConfig = {
  provider?: string;
  defaultProvider?: string;
};

type EmbeddingConfig = {
  provider?: string;
};

type TokenUsageResponse = {
  usage: TokenUsageSummary;
};

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function statusBadge(status: string | undefined) {
  const value = status?.toLowerCase?.() ?? "unknown";
  if (value.includes("running")) return <Badge variant="info">Running</Badge>;
  if (value.includes("success") || value.includes("completed")) return <Badge variant="success">Success</Badge>;
  if (value.includes("error") || value.includes("failed")) return <Badge variant="error">Error</Badge>;
  if (value.includes("pending")) return <Badge variant="warning">Pending</Badge>;
  return <Badge variant="default">Idle</Badge>;
}

export default function AppDashboardPage() {
  const router = useRouter();
  const { activeWorkspace: workspace } = useWorkspace();
  const [sessions, setSessions] = useState<ConversationHistoryItem[]>([]);
  const [runs, setRuns] = useState<AgentGraphRunSummary[]>([]);
  const [graphs, setGraphs] = useState<AgentGraphSummary[]>([]);
  const [vectorStatus, setVectorStatus] = useState<VectorStatus | null>(null);
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [repoScanOpen, setRepoScanOpen] = useState(false);
  const [repoScanLogs, setRepoScanLogs] = useState<string[]>([]);
  const [repoScanRunning, setRepoScanRunning] = useState(false);
  const [repoScanError, setRepoScanError] = useState<string | null>(null);

  const provider = llmConfig?.provider || llmConfig?.defaultProvider || "";
  const { status: llmStatus, message: llmMessage, recheck: recheckLlm } = useLlmHealth(provider);

  const checklist = useMemo(() => {
    const repoConnected = Boolean(workspace?.rootPath);
    const llmReady = Boolean(provider);
    const embeddingsReady = Boolean(embeddingConfig?.provider);
    const vectorsReady = Boolean((vectorStatus?.indexedFiles ?? 0) > 0);

    return [
      { label: "Connect repo", done: repoConnected, href: "/app/config/context" },
      { label: "Set LLM", done: llmReady, href: "/app/config/llm" },
      { label: "Set embeddings", done: embeddingsReady, href: "/app/config/llm" },
      { label: "Build vectors", done: vectorsReady, href: "/app/vectors" },
    ];
  }, [workspace?.rootPath, provider, embeddingConfig?.provider, vectorStatus?.indexedFiles]);

  const recentSessions = useMemo(() => sessions.filter((s) => s.status !== "archived").slice(0, 6), [sessions]);
  const recentRuns = useMemo(() => runs.slice(0, 6), [runs]);

  const fetchRunsForGraphs = useCallback(async (graphList: AgentGraphSummary[]) => {
    if (!graphList.length) {
      setRuns([]);
      return;
    }

    const candidates = graphList.slice(0, 4);
    const runGroups = await Promise.all(
      candidates.map(async (graph) => {
        const res = await fetch(`/api/agent-graph-runs?graphId=${encodeURIComponent(graph._id)}&limit=4`);
        if (!res.ok) return [] as AgentGraphRunSummary[];
        const data = (await res.json()) as { runs?: AgentGraphRunSummary[] };
        return Array.isArray(data.runs) ? data.runs : [];
      })
    );

    const merged = runGroups.flat();
    merged.sort((a, b) => (new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime()));
    setRuns(merged);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, graphsRes, vectorRes, llmRes, embeddingRes] = await Promise.all([
        fetch("/api/agent"),
        fetch("/api/agent-graphs"),
        fetch("/api/vectors"),
        fetch("/api/llm-config"),
        fetch("/api/embedding-config"),
      ]);

      if (sessionsRes.ok) {
        const data = (await sessionsRes.json()) as ConversationHistoryItem[];
        setSessions(Array.isArray(data) ? data : []);
      }

      if (graphsRes.ok) {
        const data = (await graphsRes.json()) as { graphs?: AgentGraphSummary[] };
        const list = Array.isArray(data.graphs) ? data.graphs : [];
        setGraphs(list);
        void fetchRunsForGraphs(list);
      } else {
        setGraphs([]);
        setRuns([]);
      }


      if (vectorRes.ok) {
        setVectorStatus(await vectorRes.json());
      }

      if (llmRes.ok) {
        setLlmConfig(await llmRes.json());
      }

      if (embeddingRes.ok) {
        setEmbeddingConfig(await embeddingRes.json());
      }

      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const tokenRes = await fetch(`/api/token-usage/summary?from=${encodeURIComponent(from)}`);
      if (tokenRes.ok) {
        const data = (await tokenRes.json()) as TokenUsageResponse;
        setTokenUsage(data.usage ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchRunsForGraphs]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const startNewSession = useCallback(async () => {
    setActionLoading("new-session");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: DEFAULT_TITLE, ...(workspace?.id ? { workspaceId: workspace.id } : {}) }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { id: string };
      if (data?.id) {
        sessionStorage.setItem(STORAGE_KEY, data.id);
      }
      router.push("/app/agent");
    } finally {
      setActionLoading(null);
    }
  }, [router, workspace?.id]);

  const openDeepAgent = useCallback(() => {
    router.push("/app/agent");
  }, [router]);

  const createVectorIndex = useCallback(async () => {
    setActionLoading("vectors");
    try {
      await fetch("/api/vectors/index", { method: "POST" });
      const res = await fetch("/api/vectors");
      if (res.ok) setVectorStatus(await res.json());
    } finally {
      setActionLoading(null);
    }
  }, []);

  const runRepoScan = useCallback(async () => {
    setRepoScanOpen(true);
    setRepoScanLogs([]);
    setRepoScanError(null);
    setRepoScanRunning(true);

    try {
      const res = await fetch("/api/repo-scan", { method: "POST" });
      if (!res.ok || !res.body) {
        setRepoScanError(res.statusText || "Failed to start repo scan.");
        setRepoScanRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.replace("data:", "").trim();
          try {
            const event = JSON.parse(payload) as { type?: string; message?: string };
            const message = typeof event.message === "string" ? event.message : null;
            if (event.type === "error") {
              setRepoScanError(message || "Repo scan failed.");
            }
            if (message) {
              setRepoScanLogs((prev) => [...prev, message]);
            }
          } catch {
            setRepoScanLogs((prev) => [...prev, payload]);
          }
        }
      }
    } catch (error) {
      setRepoScanError(error instanceof Error ? error.message : "Repo scan failed.");
    } finally {
      setRepoScanRunning(false);
    }
  }, []);

  const vectorStatusLabel = useMemo(() => {
    if (!vectorStatus) return "Unknown";
    if (vectorStatus.isIndexing) return "Indexing";
    if ((vectorStatus.indexedFiles ?? 0) > 0) return "Ready";
    return "Empty";
  }, [vectorStatus]);

  const vectorDetail = useMemo(() => {
    if (!vectorStatus) return "No index data available.";
    const indexed = vectorStatus.indexedFiles ?? 0;
    const total = vectorStatus.totalFiles ?? 0;
    if (vectorStatus.isIndexing) {
      return `Indexing ${indexed}/${total} files`;
    }
    if (indexed > 0) {
      return `${indexed} files indexed · ${vectorStatus.totalChunks ?? 0} chunks`;
    }
    return "No vectors built yet";
  }, [vectorStatus]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">App Overview</h1>
          <p className="text-sm text-text-muted">Pick a surface, launch a task, or check system health.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Launchpad</h2>
                <p className="text-xs text-text-muted">Primary surfaces to jump into.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {LAUNCHPAD.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group rounded-xl border border-border-subtle bg-bg-surface p-4 transition hover:border-border-strong hover:bg-bg-elevated"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated text-text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-text-muted transition group-hover:text-text-primary" />
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                      <p className="mt-1 text-xs text-text-muted">{item.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Quick Actions</h2>
              <p className="text-xs text-text-muted">Launch workflows from here.</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={startNewSession} disabled={actionLoading === "new-session"}>
              <Plus className="h-4 w-4" />
              New session
            </Button>
            <Button variant="secondary" onClick={openDeepAgent}>
              <Play className="h-4 w-4" />
              Open Deep Agent
            </Button>
            <Button
              variant="secondary"
              onClick={runRepoScan}
              disabled={repoScanRunning}
            >
              <Scan className="h-4 w-4" />
              {repoScanRunning ? "Scanning repo..." : "Run repo scan"}
            </Button>
            <Button variant="secondary" onClick={createVectorIndex} disabled={actionLoading === "vectors"}>
              <Database className="h-4 w-4" />
              Create vector index
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Recent Activity</h2>
                <p className="text-xs text-text-muted">Latest sessions and graph runs.</p>
              </div>
              <Badge variant="default">{recentSessions.length + recentRuns.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Sessions</p>
                <Link href="/app/agent" className="text-xs text-text-muted hover:text-text-primary">View all</Link>
              </div>
              {loading ? (
                <LoadingState message="Loading sessions" />
              ) : recentSessions.length === 0 ? (
                <EmptyState title="No sessions yet" description="Start a new exploration session." />
              ) : (
                <div className="space-y-2">
                  {recentSessions.map((session) => (
                    <Link
                      key={session.id}
                      href="/app/agent"
                      className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted transition hover:border-border-strong hover:text-text-primary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{session.title || "Untitled"}</p>
                        <p className="text-[11px]">Updated {formatWhen(session.updatedAt)}</p>
                      </div>
                      <Badge variant={session.lastRole === "assistant" ? "success" : "default"}>
                        {session.lastRole || "idle"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Runs</p>
                <Link href="/app/agent-graphs" className="text-xs text-text-muted hover:text-text-primary">View graphs</Link>
              </div>
              {loading ? (
                <LoadingState message="Loading runs" />
              ) : recentRuns.length === 0 ? (
                <EmptyState title="No runs yet" description="Kick off a Deep Agent run." />
              ) : (
                <div className="space-y-2">
                  {recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">Run {run.id.slice(0, 6)}…</p>
                        <p className="text-[11px] text-text-muted">Started {formatWhen(run.startedAt)}</p>
                      </div>
                      {statusBadge(run.status)}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Setup Checklist</h2>
              <p className="text-xs text-text-muted">Complete these to unlock the full stack.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-muted transition hover:border-border-strong hover:text-text-primary"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-status-success-text" : "text-text-muted"}`} />
                  <span>{item.label}</span>
                </div>
                <Badge variant={item.done ? "success" : "default"}>{item.done ? "Done" : "Todo"}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">System Health</h2>
              <p className="text-xs text-text-muted">Live status for core services.</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Panel className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">LLM</p>
                <Button variant="ghost" size="sm" onClick={recheckLlm}>Check</Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {llmStatus === "success" ? (
                  <Badge variant="success">Healthy</Badge>
                ) : llmStatus === "error" ? (
                  <Badge variant="error">Error</Badge>
                ) : llmStatus === "loading" ? (
                  <Badge variant="warning">Checking</Badge>
                ) : (
                  <Badge variant="default">Unknown</Badge>
                )}
                <span className="text-xs text-text-muted">{provider || "No provider"}</span>
              </div>
              <p className="mt-2 text-xs text-text-muted">{llmMessage || "Latest provider check."}</p>
            </Panel>

            <Panel className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Token Usage (7d)</p>
              <div className="mt-3 flex items-center justify-between">
                <TokenUsageDisplay tokenUsage={tokenUsage ?? undefined} showLabel={true} />
                <Badge variant="default">{tokenUsage?.callCount ?? 0} calls</Badge>
              </div>
              <p className="mt-2 text-xs text-text-muted">Aggregated across recent runs.</p>
            </Panel>

            <Panel className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Vector Index</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant={vectorStatusLabel === "Ready" ? "success" : vectorStatusLabel === "Indexing" ? "warning" : "default"}>
                  {vectorStatusLabel}
                </Badge>
                <span className="text-xs text-text-muted">{vectorDetail}</span>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                {vectorStatus?.schedulerStatus ? `Scheduler: ${vectorStatus.schedulerStatus}` : "Auto-index status pending."}
              </p>
            </Panel>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Workspace</h2>
              <p className="text-xs text-text-muted">Current active workspace.</p>
            </div>
          </CardHeader>
          <CardContent>
            {workspace ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-text-muted" />
                  <p className="text-sm font-medium text-text-primary">{workspace.name || "Workspace"}</p>
                </div>
                <p className="text-xs text-text-muted">{workspace.rootPath}</p>
                <Link href="/app/config/context" className="text-xs text-text-muted hover:text-text-primary">
                  Manage workspace
                </Link>
              </div>
            ) : (
              <EmptyState title="No workspace" description="Connect a repo to enable agent workflows." />
            )}
          </CardContent>
        </Card>
      </section>

      {repoScanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border-strong bg-bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Repo Scan</p>
                <p className="text-xs text-text-muted">Streaming analysis logs.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRepoScanOpen(false)}>
                Close
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-border-subtle bg-bg-app p-3 text-xs text-text-muted h-64 overflow-y-auto">
              {repoScanLogs.length === 0 && !repoScanRunning && !repoScanError && (
                <p>Ready to scan the repo.</p>
              )}
              {repoScanLogs.map((log, idx) => (
                <p key={`${log}-${idx}`} className="mb-1">{log}</p>
              ))}
              {repoScanRunning && (
                <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                  <Clock className="h-3 w-3 animate-pulse" />
                  Scanning...
                </div>
              )}
              {repoScanError && (
                <p className="mt-2 text-xs text-status-error-text">{repoScanError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
