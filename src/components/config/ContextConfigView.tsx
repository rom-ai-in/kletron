"use client";

import { useEffect, useState, useRef } from "react";
import { Settings, CheckCircle2, AlertCircle, Scan, Terminal, ChevronRight } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import { AuditContextForm } from "@/src/components/AuditContextForm";
import { RepoContextGraph } from "@/src/components/config/RepoContextGraph";
import type { AuditContext } from "@/src/shared/auditContext";
import type { RepoAnalysisResult } from "@/src/types";

function formatAuditContextSummary(context: AuditContext | undefined): string | null {
  if (!context) return null;
  const parts: string[] = [];
  if (context.mission?.trim()) {
    parts.push(`Mission: ${context.mission.trim().slice(0, 20)}...`);
  }
  if (context.startupPhase) {
    parts.push(`Phase: ${context.startupPhase}`);
  }
  if (parts.length === 0) return null;
  return parts.join(" | ");
}

export function ContextConfigView() {
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
    // Also try to load cached graph data locally for instant load
    const storedGraph = window.localStorage.getItem("numezis-repo-graph");
    if (storedGraph) {
      try { setRepoGraphData(JSON.parse(storedGraph)); } catch (e) { }
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
      const response = await fetch("/api/repo-scan", {
        method: "POST",
      });

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
        buffer = lines.pop() || ""; // Keep incomplete chunk

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "log") {
                setScanLogs(prev => [...prev, data.message]);
              } else if (data.type === "error") {
                setError(data.message);
                setIsScanning(false);
              } else if (data.type === "result") {
                const result = data.payload as RepoAnalysisResult;
                setRepoGraphData(result);

                // Merge Result into Audit Context automatically
                setAuditContext(prev => ({
                  ...prev,
                  mission: result.structureContext.mission || prev.mission,
                  constraints: [
                    ...(prev.constraints || []),
                    ...result.structureContext.invariants
                  ],
                  techStack: result.structureContext.techStack,
                }));

                setScanLogs(prev => [...prev, "Context Updated."]);
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

  // Auto-scroll logs
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scanLogs]);


  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Project Context Soul</h1>
            <p className="text-sm text-text-muted">
              Define the mission, invariants, and architecture.
            </p>
          </div>
        </div>
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
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${auditContextEnabled ? "bg-emerald-500" : "bg-bg-elevated border border-border-subtle"}`}
            >
              <span
                className={`${auditContextEnabled ? "translate-x-4" : "translate-x-0.5"} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
              />
            </button>
          </div>
          {isSaved && (
            <span className="text-xs font-medium text-emerald-500">Saved</span>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Form */}
        <div className="w-1/2 overflow-y-auto p-6 border-r border-border-subtle scrollbar-elegant">
          {error && (
            <Panel className="p-3 mb-4 border border-border-subtle bg-bg-elevated text-rose-300 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-rose-400" />
                <span>{error}</span>
              </div>
            </Panel>
          )}

          <div className="mb-6">
            <Panel
              className={`p-4 border-l-4 ${auditContextEnabled ? "border-l-emerald-500" : "border-l-text-muted"}`}
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
                    Global grounding is {auditContextEnabled ? "active" : "inactive"}.
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <div
            className={`transition-opacity duration-200 ${auditContextEnabled ? "opacity-100" : "opacity-50 pointer-events-none grayscale"}`}
          >
            {/* Using key to force remount when context changes from scan */}
            <AuditContextForm
              key={JSON.stringify(auditContext)}
              initialContext={auditContext}
              onSave={handleSave}
              onCancel={() => { }}
            />
          </div>
        </div>

        {/* RIGHT PANEL: Graph & Scanner */}
        <div className="w-1/2 flex flex-col bg-zinc-50/50 relative">
          {/* Graph Header */}
          <div className="h-12 border-b border-border-subtle px-4 flex items-center justify-between bg-white/50 backdrop-blur">
            <div className="flex items-center gap-2">
              <Scan className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Project Graph</span>
            </div>
            {!isScanning && (
              <Button size="sm" onClick={startRepoScan} className="h-8 text-xs gap-2">
                <Scan className="w-3 h-3" />
                {repoGraphData ? "Re-Analyze Repo" : "Analyze Repo"}
              </Button>
            )}
          </div>

          {/* Graph Area */}
          <div className="flex-1 relative overflow-hidden">
            <RepoContextGraph
              data={repoGraphData}
              onNodeClick={(id) => console.log("Node clicked", id)}
            />

            {/* Console Overlay during scan */}
            {isScanning && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-4 font-mono text-xs overflow-hidden flex flex-col z-50 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-emerald-400 mb-2 border-b border-white/10 pb-2">
                  <Terminal className="w-4 h-4" />
                  <span className="font-bold">DEEP SCAN RUNNING...</span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none space-y-1">
                  {scanLogs.map((log, i) => (
                    <div key={i} className="text-zinc-300 flex gap-2">
                      <span className="text-zinc-600 select-none">{">"}</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Footer */}
          <div className="h-8 border-t border-border-subtle bg-white px-4 flex items-center gap-4 text-[10px] text-zinc-400">
            {repoGraphData && (
              <>
                <span>Nodes: {repoGraphData.nodes.length}</span>
                <span>Edges: {repoGraphData.edges.length}</span>
                <span>Stack: {repoGraphData.structureContext?.techStack?.join(", ") || "Unknown"}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
