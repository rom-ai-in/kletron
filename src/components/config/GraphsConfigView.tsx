"use client";

import { useMemo, useState } from "react";
import { Layers, Wrench, ListTree } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import { Modal } from "@/src/components/ui/Modal";
import { graphOptions, type GraphOption } from "@/src/shared/graphCatalog";

export function GraphsConfigView() {
  const graphs = useMemo(() => graphOptions, []);
  const [selected, setSelected] = useState<GraphOption | null>(null);

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
              Explore available agent flows (graphs) and the phases/tools they use
            </p>
          </div>
        </div>
        <div className="text-xs text-text-muted">{graphs.length} graphs available</div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {graphs.map((g) => (
            <Panel key={g.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-text-muted" />
                    <h2 className="text-sm font-semibold text-text-primary truncate">{g.name}</h2>
                    <span className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] font-mono text-text-muted">
                      {g.id}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{g.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                    <span className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1">
                      {g.phases.length} phases
                    </span>
                    <span className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1">
                      {g.toolNames.length} tools
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
        title={selected ? `Graph: ${selected.id}` : undefined}
        subtitle={selected?.name}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted">
              {selected ? `${selected.phases.length} phases • ${selected.toolNames.length} tools` : ""}
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
                  Phases
                </h3>
              </div>
              <div className="divide-y divide-border-subtle">
                {selected.phases.map((p) => (
                  <div key={p.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{p.label}</p>
                        <p className="mt-1 text-xs text-text-muted">{p.summary}</p>
                      </div>
                      <span className="rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] font-mono text-text-muted">
                        {p.id}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-text-secondary">{p.description}</p>
                    <div className="mt-3 text-[11px] text-text-muted">
                      Tools: {p.toolNames?.length ? p.toolNames.join(", ") : "none"}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-0 overflow-hidden">
              <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-emerald-500" />
                  Tool allow-list
                </h3>
              </div>
              <div className="p-5 text-xs text-text-secondary">
                <div className="flex flex-wrap gap-2">
                  {selected.toolNames.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-border-subtle bg-bg-app px-2 py-1 text-[11px] font-mono text-text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </Modal>
    </div>
  );
}

