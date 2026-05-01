"use client";

import { useEffect, useState } from "react";
import { Layers, Wrench, ListTree } from "lucide-react";
import {
    Panel,
    Button,
    Skeleton,
    ConfigExplorerModal,
    ConfigExplorerSection,
    ConfigExplorerRow,
    ConfigExplorerMonoBlock,
} from "../design-system";

export function GraphsConfigView() {
    const [graphs, setGraphs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch("/api/agent-graphs")
            .then((r) => r.json())
            .then((data) => setGraphs(Array.isArray(data?.graphs) ? data.graphs : []))
            .catch(() => setGraphs([]))
            .finally(() => setLoading(false));
    }, []);

    const nodeCount = Array.isArray(selected?.nodes) ? selected.nodes.length : 0;
    const edgeCount = Array.isArray(selected?.edges) ? selected.edges.length : 0;

    return (
        <div className="flex h-full flex-col overflow-hidden bg-bg-app">
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
                <div className="text-xs text-text-muted">
                    {loading ? "Loading…" : `${graphs.length} graphs available`}
                </div>
            </div>

            <div className="scrollbar-elegant flex-1 space-y-6 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

                    {!loading &&
                        graphs.map((g) => (
                            <Panel key={g.id} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-text-muted" />
                                            <h2 className="truncate text-sm font-semibold text-text-primary">
                                                {g.name}
                                            </h2>
                                            <span className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
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

            <ConfigExplorerModal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected ? `Graph: ${String(selected._id ?? "")}` : undefined}
                subtitle={selected?.name}
                footerSummary={
                    selected ? `${nodeCount} nodes • ${edgeCount} edges` : undefined
                }
            >
                {selected && (
                    <>
                        <Panel className="p-4">
                            <p className="text-xs text-text-secondary">{selected.description}</p>
                        </Panel>

                        <ConfigExplorerSection title="Nodes" icon={ListTree} variant="divided">
                            {(Array.isArray(selected.nodes) ? selected.nodes : []).map((n: any) => (
                                <ConfigExplorerRow
                                    key={n.id}
                                    title={n.label}
                                    subtitle={`tools: ${Array.isArray(n.react?.toolNames) ? n.react.toolNames.length : 0} • schema: ${n.output?.schemaId ?? "generic_json"}`}
                                    badge={n.id}
                                />
                            ))}
                        </ConfigExplorerSection>

                        <ConfigExplorerSection title="Edges" icon={Wrench} variant="stack">
                            {(Array.isArray(selected.edges) ? selected.edges : []).map((e: any) => (
                                <ConfigExplorerMonoBlock key={e.id}>
                                    {e.source} → {e.target}
                                </ConfigExplorerMonoBlock>
                            ))}
                            {(!Array.isArray(selected.edges) || selected.edges.length === 0) && (
                                <div className="text-xs text-text-muted">No edges (single node graph).</div>
                            )}
                        </ConfigExplorerSection>
                    </>
                )}
            </ConfigExplorerModal>
        </div>
    );
}
