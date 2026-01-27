"use client";

import { useEffect, useState, useRef } from "react";
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  Scan,
  Terminal,
  Brain,
  Target,
  Activity,
  Layers,
  FileCode,
  GitBranch,
  Zap,
  RefreshCw,
} from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import { AuditContextForm } from "@/src/components/AuditContextForm";
import { ContextVisualizer } from "@/src/components/context/ContextVisualizer";
import { ContextTracePanel } from "@/src/components/context/ContextTracePanel";
import type { AuditContext } from "@/src/shared/auditContext";
import type { RepoAnalysisResult } from "@/src/types";

// --- Tab Types ---
type TabId = "soul" | "context" | "trace";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: TabConfig[] = [
  { id: "soul", label: "Project Soul", icon: Brain, description: "Mission, phase & constraints" },
  { id: "context", label: "Active Context", icon: Layers, description: "Knowledge graph nodes" },
  { id: "trace", label: "Trace & Debug", icon: Target, description: "Test relevance ranking" },
];

// --- Repo Stats Card ---
interface RepoStatsCardProps {
  data: RepoAnalysisResult | null;
  isScanning: boolean;
  onScan: () => void;
}

function RepoStatsCard({ data, isScanning, onScan }: RepoStatsCardProps) {
  return (
    <Panel className="p-4 border border-border-subtle bg-bg-elevated/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
            <Scan size={14} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Repository Analysis</h3>
        </div>
        <Button
          size="sm"
          variant={isScanning ? "secondary" : "primary"}
          onClick={onScan}
          disabled={isScanning}
          className="h-7 text-xs gap-1.5"
        >
          {isScanning ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Scan size={12} />
              {data ? "Re-scan" : "Analyze"}
            </>
          )}
        </Button>
      </div>

      {data ? (
        <div className="grid grid-cols-4 gap-3">
          <StatBlock
            icon={FileCode}
            label="Nodes"
            value={data.nodes.length}
            color="text-cyan-400"
          />
          <StatBlock
            icon={GitBranch}
            label="Edges"
            value={data.edges.length}
            color="text-purple-400"
          />
          <StatBlock
            icon={Zap}
            label="Tech Stack"
            value={data.structureContext?.techStack?.length || 0}
            color="text-amber-400"
          />
          <StatBlock
            icon={Activity}
            label="Invariants"
            value={data.structureContext?.invariants?.length || 0}
            color="text-emerald-400"
          />
        </div>
      ) : (
        <div className="text-center py-6 text-text-muted text-xs">
          <p>No analysis data. Run a scan to populate the knowledge graph.</p>
        </div>
      )}

      {data?.structureContext?.techStack && data.structureContext.techStack.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Detected Stack</p>
          <div className="flex flex-wrap gap-1.5">
            {data.structureContext.techStack.map((tech, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] font-medium bg-bg-surface border border-border-subtle rounded text-text-secondary"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-bg-surface border border-border-subtle">
      <Icon size={14} className={`${color} mb-1`} />
      <span className="text-lg font-bold text-text-primary">{value}</span>
      <span className="text-[9px] text-text-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

// --- Scan Console Overlay ---
function ScanConsole({ logs, isActive }: { logs: string[]; isActive: boolean }) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm p-6 font-mono text-xs flex flex-col animate-in fade-in duration-300">
      <div className="flex items-center gap-2 text-emerald-400 mb-4 border-b border-white/10 pb-3">
        <Terminal className="w-5 h-5" />
        <span className="font-bold text-sm">DEEP SCAN IN PROGRESS...</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="text-zinc-300 flex gap-2">
            <span className="text-zinc-600 select-none">{">"}</span>
            <span>{log}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

// --- Main Component ---
export function ContextConfigView() {
  const [activeTab, setActiveTab] = useState<TabId>("soul");
  const [auditContext, setAuditContext] = useState<AuditContext>({});
  const [auditContextEnabled, setAuditContextEnabled] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scan Logic State
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [repoGraphData, setRepoGraphData] = useState<RepoAnalysisResult | null>(null);

  // Load initial config
  useEffect(() => {
    let hadLocal = false;
    const stored = window.localStorage.getItem("numezis-audit-context");
    const storedGraph = window.localStorage.getItem("numezis-repo-graph");

    if (storedGraph) {
      try {
        setRepoGraphData(JSON.parse(storedGraph));
      } catch (e) {
        /* ignore */
      }
    }

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed.enabled === "boolean") setAuditContextEnabled(parsed.enabled);
        if (parsed.context) setAuditContext(parsed.context);
        hadLocal = true;
      } catch (e) {
        console.error("Failed to parse stored context", e);
      }
    }

    fetch("/api/context-config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) return;
        if (!hadLocal) {
          if (typeof data.enabled === "boolean") setAuditContextEnabled(data.enabled);
          if (data.context) setAuditContext(data.context);
        }
      })
      .catch(() => { })
      .finally(() => setHasLoaded(true));
  }, []);

  // Persist State
  useEffect(() => {
    if (!hasLoaded) return;
    const payload = { enabled: auditContextEnabled, context: auditContext };
    window.localStorage.setItem("numezis-audit-context", JSON.stringify(payload));
    if (repoGraphData) {
      window.localStorage.setItem("numezis-repo-graph", JSON.stringify(repoGraphData));
    }
  }, [auditContext, auditContextEnabled, hasLoaded, repoGraphData]);

  const persist = async (nextEnabled: boolean, nextContext: AuditContext) => {
    setError(null);
    const res = await fetch("/api/context-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled, context: nextContext }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as any)?.error || "Failed to save context config");
    }
  };

  const handleSave = async (newContext: AuditContext) => {
    setAuditContext(newContext);
    try {
      await persist(auditContextEnabled, newContext);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startRepoScan = async () => {
    setIsScanning(true);
    setScanLogs([]);
    setError(null);

    try {
      const response = await fetch("/api/repo-scan", { method: "POST" });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start scan");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "log") {
                setScanLogs((prev) => [...prev, data.message]);
              } else if (data.type === "error") {
                setError(data.message);
                setIsScanning(false);
              } else if (data.type === "result") {
                const result = data.payload as RepoAnalysisResult;
                setRepoGraphData(result);

                // Merge Result into Audit Context automatically
                setAuditContext((prev) => ({
                  ...prev,
                  mission: result.structureContext.mission || prev.mission,
                  constraints: [
                    ...(prev.constraints || []),
                    ...result.structureContext.invariants,
                  ],
                }));

                setScanLogs((prev) => [...prev, "✓ Context Updated."]);
                setIsScanning(false);
              }
            } catch (e) {
              console.error("Parse error", e);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setIsScanning(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      {/* Scan Console Overlay */}
      <ScanConsole logs={scanLogs} isActive={isScanning} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-main/10 text-primary-main">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Context Configuration</h1>
            <p className="text-sm text-text-muted">
              Define project soul, manage knowledge graph, and debug context ranking.
            </p>
          </div>
        </div>

        {/* Context Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${auditContextEnabled ? "text-text-primary" : "text-text-muted"}`}
            >
              {auditContextEnabled ? "Active" : "Disabled"}
            </span>
            <button
              type="button"
              onClick={async () => {
                const next = !auditContextEnabled;
                setAuditContextEnabled(next);
                try {
                  await persist(next, auditContext);
                  setIsSaved(true);
                  setTimeout(() => setIsSaved(false), 1500);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${auditContextEnabled
                  ? "bg-emerald-500"
                  : "bg-bg-elevated border border-border-subtle"
                }`}
            >
              <span
                className={`${auditContextEnabled ? "translate-x-4" : "translate-x-0.5"
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
              />
            </button>
          </div>
          {isSaved && <span className="text-xs font-medium text-emerald-500">Saved</span>}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border-subtle bg-bg-surface/50">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                  ? "bg-primary-main/10 text-primary-main ring-1 ring-primary-main/30"
                  : "text-text-muted hover:text-text-primary hover:bg-state-hover"
                }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4">
          <Panel className="p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-rose-400" />
              <span>{error}</span>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Tab 1: Project Soul */}
        {activeTab === "soul" && (
          <div className="h-full overflow-y-auto p-6 scrollbar-elegant">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Status Card */}
              <Panel
                className={`p-4 border-l-4 ${auditContextEnabled ? "border-l-emerald-500" : "border-l-text-muted"
                  }`}
              >
                <div className="flex items-start gap-3">
                  {auditContextEnabled ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-text-muted mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      {auditContextEnabled ? "Context Injection Enabled" : "Context Injection Paused"}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">
                      Global grounding is {auditContextEnabled ? "active" : "inactive"}. The agent
                      will {auditContextEnabled ? "" : "not "}use project context in prompts.
                    </p>
                  </div>
                </div>
              </Panel>

              {/* Repo Stats */}
              <RepoStatsCard data={repoGraphData} isScanning={isScanning} onScan={startRepoScan} />

              {/* Form */}
              <div
                className={`transition-opacity duration-200 ${auditContextEnabled ? "opacity-100" : "opacity-50 pointer-events-none grayscale"
                  }`}
              >
                <AuditContextForm
                  key={JSON.stringify(auditContext)}
                  initialContext={auditContext}
                  onSave={handleSave}
                  onCancel={() => { }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Active Context (Knowledge Graph) */}
        {activeTab === "context" && (
          <div className="h-full">
            <ContextVisualizer />
          </div>
        )}

        {/* Tab 3: Trace & Debug */}
        {activeTab === "trace" && (
          <div className="h-full flex">
            <div className="flex-1 p-6 overflow-y-auto scrollbar-elegant">
              <div className="max-w-2xl mx-auto">
                <Panel className="p-6 bg-bg-elevated border border-border-subtle">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary-main/10 text-primary-main">
                      <Target size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-text-primary">
                        Context Relevance Debugger
                      </h2>
                      <p className="text-xs text-text-muted">
                        Test how the ranking engine scores context nodes for a query.
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Use the panel on the right to enter a sample prompt. The system will calculate
                    relevance scores for each node in the knowledge graph based on:
                  </p>
                  <ul className="mt-3 text-sm text-text-secondary space-y-1 list-disc list-inside">
                    <li>Direct mention of file paths or symbols</li>
                    <li>Topological proximity (import chains)</li>
                    <li>Recent activity (views & edits)</li>
                    <li>Semantic similarity (when embeddings are available)</li>
                  </ul>
                </Panel>
              </div>
            </div>
            <div className="w-[400px] border-l border-border-subtle h-full overflow-hidden">
              <ContextTracePanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
