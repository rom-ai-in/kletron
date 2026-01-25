"use client";

import { useMemo, useState } from "react";
import { Layers, Wrench, ListTree } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import { Modal } from "@/src/components/ui/Modal";
import { Skeleton } from "@/src/components/ui/Skeleton";

export function GraphsConfigView() {
  const [graphs, setGraphs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  useMemo(() => {
    // load once
    setLoading(true);
    fetch("/api/agent-graphs")
      .then((r) => r.json())
      .then((data) => setGraphs(Array.isArray(data?.graphs) ? data.graphs : []))
      .catch(() => setGraphs([]))
      .finally(() => setLoading(false));
    return null;
  }, []);

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
            <ListTree className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Graph Configuration</h1>
            <p className="text-sm text-text-muted">
              Explore DB-backed agent graphs (nodes + edges + tool allow-lists)
            </p>
          </div>
        </div>
        <div className="text-xs text-text-muted">{loading ? "Loading…" : `${graphs.length} graphs available`}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loading &&
            [1, 2, 3, 4].map((i) => (
              <Panel key={i} className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-52" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
              </Panel>
            ))}

          {!loading && graphs.map((g) => (
            <Panel key={g.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-text-muted" />
                    <h2 className="text-sm font-semibold text-text-primary truncate">{g.name}</h2>
                    <span className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] font-mono text-text-muted">
                      {String(g._id ?? "")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{g.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                    <span className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1">
                      {Array.isArray(g.nodes) ? g.nodes.length : 0} nodes
                    </span>
                    <span className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1">
                      {Array.isArray(g.edges) ? g.edges.length : 0} edges
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setSelected(g)}>
                  View details
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Graph: ${String(selected._id ?? "")}` : undefined}
        subtitle={selected?.name}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted">
              {selected
                ? `${Array.isArray(selected.nodes) ? selected.nodes.length : 0} nodes • ${Array.isArray(selected.edges) ? selected.edges.length : 0} edges`
                : ""}
            </div>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-5">
            <Panel className="p-4">
              <p className="text-xs text-text-secondary">{selected.description}</p>
            </Panel>

            <Panel className="p-0 overflow-hidden">
              <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <ListTree className="h-4 w-4 text-emerald-500" />
                  Nodes
                </h3>
              </div>
              <div className="divide-y divide-border-subtle">
                {(Array.isArray(selected.nodes) ? selected.nodes : []).map((n: any) => (
                  <div key={n.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{n.label}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          tools: {Array.isArray(n.react?.toolNames) ? n.react.toolNames.length : 0} • schema:{" "}
                          {n.output?.schemaId ?? "generic_json"}
                        </p>
                      </div>
                      <span className="rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] font-mono text-text-muted">
                        {n.id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-0 overflow-hidden">
              <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-emerald-500" />
                  Edges
                </h3>
              </div>
              <div className="p-5 text-xs text-text-secondary space-y-2">
                {(Array.isArray(selected.edges) ? selected.edges : []).map((e: any) => (
                  <div key={e.id} className="rounded border border-border-subtle bg-bg-app px-3 py-2 font-mono text-[11px] text-text-muted">
                    {e.source} → {e.target}
                  </div>
                ))}
                {(!Array.isArray(selected.edges) || selected.edges.length === 0) && (
                  <div className="text-xs text-text-muted">No edges (single node graph).</div>
                )}
              </div>
            </Panel>
          </div>
        )}
      </Modal>
    </div>
  );
}

