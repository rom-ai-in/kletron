import { useEffect, useState, useCallback } from "react";
import { AgentGraphCard } from "@kletron/ui/components/agentGraphs/AgentGraphCard";
import { AgentGraphEditor } from "@kletron/ui/components/agentGraphs/AgentGraphEditor";
import { ThreadApprovalModeSelector } from "@kletron/ui/components/Agent/ThreadApprovalModeSelector";
import type { AgentGraphSummary, AgentGraphRunSummary } from "../types";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";

export function AgentGraphsPanel({
  backendUrlTrimmed,
  getAccessToken,
  activeWorkspaceId,
  graphs,
  graphsLoading,
  graphRuns,
  graphRunsLoading,
  loadGraphRuns,
  apiFetch,
  onOpenRunInAgent,
}: {
  backendUrlTrimmed: string;
  getAccessToken: () => Promise<string | null>;
  activeWorkspaceId: string | null;
  graphs: AgentGraphSummary[];
  graphsLoading: boolean;
  graphRuns: AgentGraphRunSummary[];
  graphRunsLoading: boolean;
  loadGraphRuns: (graphId: string) => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onOpenRunInAgent: (runId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorGraph, setEditorGraph] = useState<Record<string, unknown> | null>(null);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [approvalRunId, setApprovalRunId] = useState<string | null>(null);
  const [approvalMode, setApprovalMode] = useState<ThreadApprovalMode>("inherit");

  useEffect(() => {
    if (graphs.length > 0 && !selectedGraphId) {
      setSelectedGraphId(graphs[0]!.id);
    }
  }, [graphs, selectedGraphId]);

  useEffect(() => {
    if (!selectedGraphId) return;
    void loadGraphRuns(selectedGraphId);
  }, [selectedGraphId, loadGraphRuns]);

  useEffect(() => {
    if (!editingId) {
      setEditorGraph(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`/api/agent-graphs/${encodeURIComponent(editingId)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const g = data?.graph;
        if (!cancelled && g) setEditorGraph(g as Record<string, unknown>);
      } catch {
        if (!cancelled) setEditorGraph(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, apiFetch]);

  const loadApprovalForRun = useCallback(
    async (runId: string) => {
      setApprovalRunId(runId);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
        const res = await fetch(`${backendUrlTrimmed}/api/sessions/${encodeURIComponent(runId)}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const mode = data?.threadApprovalMode;
        if (typeof mode === "string") setApprovalMode(mode as ThreadApprovalMode);
      } catch {
        // ignore
      }
    },
    [backendUrlTrimmed, getAccessToken, activeWorkspaceId]
  );

  const saveApprovalMode = useCallback(
    async (mode: ThreadApprovalMode) => {
      if (!approvalRunId) return;
      const token = await getAccessToken();
      if (!token) return;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
      await fetch(`${backendUrlTrimmed}/api/sessions/${encodeURIComponent(approvalRunId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ threadApprovalMode: mode }),
      });
      setApprovalMode(mode);
    },
    [approvalRunId, backendUrlTrimmed, getAccessToken, activeWorkspaceId]
  );

  if (editingId && editorGraph) {
    return (
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
          <button
            type="button"
            className="text-xs text-text-secondary hover:text-text-primary"
            onClick={() => {
              setEditingId(null);
              setEditorGraph(null);
            }}
          >
            Back to list
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <AgentGraphEditor
            graphId={editingId}
            initialGraph={editorGraph as any}
            apiFetch={apiFetch}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4 scrollbar-elegant">
      <h1 className="text-lg font-semibold text-text-primary mb-1">Agent graphs</h1>
      <p className="text-xs text-text-muted mb-4">Edit workflows used by the agent. Changes save automatically.</p>
      {graphsLoading && <div className="text-xs text-text-muted animate-pulse">Loading graphs…</div>}
      {!graphsLoading && graphs.length === 0 && (
        <div className="text-sm text-text-muted rounded-md border border-border-subtle px-4 py-6 text-center">
          No agent graphs found for this workspace.
        </div>
      )}
      <div className="grid gap-3 max-w-3xl">
        {graphs.map((g) => (
          <AgentGraphCard
            key={g.id}
            graph={{
              _id: g.id,
              name: g.name,
              description: g.description,
              updatedAt: g.updatedAt,
            }}
            onView={() => {
              setSelectedGraphId(g.id);
              setEditingId(g.id);
            }}
          />
        ))}
      </div>

      {selectedGraphId && (
        <section className="mt-8 max-w-3xl space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Recent runs</h2>
          {graphRunsLoading && <div className="text-xs text-text-muted">Loading runs…</div>}
          {!graphRunsLoading && graphRuns.length === 0 && (
            <p className="text-xs text-text-muted">No runs for this graph yet.</p>
          )}
          <ul className="space-y-1">
            {graphRuns.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-xs"
              >
                <span className="font-mono text-[10px] text-text-muted truncate max-w-[180px]">{r.id}</span>
                <span className="text-text-secondary">{r.status ?? ""}</span>
                <button
                  type="button"
                  className="text-accent-cyan hover:underline"
                  onClick={() => onOpenRunInAgent(r.id)}
                >
                  Open in agent
                </button>
                <button
                  type="button"
                  className="text-text-muted hover:text-text-primary"
                  onClick={() => void loadApprovalForRun(r.id)}
                >
                  Approval…
                </button>
              </li>
            ))}
          </ul>
          {approvalRunId && (
            <div className="mt-3 rounded-md border border-border-subtle bg-bg-elevated p-3">
              <div className="text-[11px] text-text-muted mb-2">Thread approval for run {approvalRunId.slice(0, 8)}…</div>
              <ThreadApprovalModeSelector value={approvalMode} onSelect={(m) => void saveApprovalMode(m)} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
