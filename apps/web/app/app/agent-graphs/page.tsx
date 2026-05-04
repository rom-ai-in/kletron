"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, ListTree, Wrench } from "lucide-react";

import {
    Button,
    Skeleton,
    SearchInput,
    EmptyState,
    ErrorState,
    ConfigExplorerModal,
    ConfigExplorerSection,
    ConfigExplorerRow,
    ConfigExplorerMonoBlock,
    Panel,
} from "@kletron/ui/components/design-system";
import { AgentGraphCard } from "@kletron/ui/components/agentGraphs/AgentGraphCard";
import { defaultAgentGraphPayload } from "@kletron/shared";

type AgentGraphListItem = {
    _id?: string;
    name: string;
    description?: string;
    updatedAt?: string;
    nodes?: any[];
    edges?: any[];
};

export default function AgentGraphsPage() {
    const router = useRouter();
    const [graphs, setGraphs] = useState<AgentGraphListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [inspectTarget, setInspectTarget] = useState<AgentGraphListItem | null>(null);

    useEffect(() => {
        void fetchGraphs();
    }, []);

    const fetchGraphs = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/agent-graphs");
            if (!res.ok) throw new Error("Failed to load graphs");
            const data = await res.json();
            setGraphs(data.graphs || []);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const filtered = graphs.filter((g) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            g.name.toLowerCase().includes(q) ||
            (g.description ?? "").toLowerCase().includes(q)
        );
    });

    const handleCreate = async () => {
        try {
            const res = await fetch("/api/agent-graphs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(defaultAgentGraphPayload()),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create graph");
            }
            const data = await res.json();
            router.push(`/app/agent-graphs/${data.graphId}`);
        } catch (err: any) {
            alert(err.message || "Failed to create graph");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/agent-graphs/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete graph");
            }
            void fetchGraphs();
        } catch (err: any) {
            alert(err.message || "Failed to delete graph");
        }
    };

    const handleQuickRun = async (id: string) => {
        try {
            const res = await fetch(`/api/agent-graphs/${id}/runs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mission: "" }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to start run");
            }
            const data = await res.json();
            router.push(`/app/agent-graphs/${id}/runs/${data.runId}`);
        } catch (err: any) {
            alert(err.message || "Failed to start run");
        }
    };

    const nodeCount = Array.isArray(inspectTarget?.nodes) ? inspectTarget!.nodes!.length : 0;
    const edgeCount = Array.isArray(inspectTarget?.edges) ? inspectTarget!.edges!.length : 0;

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <Layers className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Agent Graphs</h1>
                        <p className="text-sm text-text-muted">
                            Edit DAGs, inspect node tool allow-lists, and run live executions on the server
                        </p>
                    </div>
                </div>
                <Button onClick={() => void handleCreate()}>+ New Agent Graph</Button>
            </div>

            <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <SearchInput
                    placeholder="Search graphs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    className="flex-1"
                />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6">
                {loading && (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-3 flex-1">
                                        <Skeleton className="h-5 w-48" />
                                        <Skeleton className="h-4 w-3/4" />
                                        <div className="flex gap-4 pt-1">
                                            <Skeleton className="h-3 w-24" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Skeleton className="h-8 w-16" />
                                        <Skeleton className="h-8 w-16" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && <ErrorState message={error} onRetry={() => void fetchGraphs()} />}

                {!loading && !error && (
                    <div className="space-y-4">
                        {filtered.map((graph) => (
                            <AgentGraphCard
                                key={graph._id}
                                graph={graph}
                                onInspect={() => setInspectTarget(graph)}
                                onQuickRun={() => graph._id && void handleQuickRun(graph._id)}
                                onView={() => router.push(`/app/agent-graphs/${graph._id}`)}
                                onDelete={() => graph._id && void handleDelete(graph._id)}
                            />
                        ))}

                        {filtered.length === 0 && (
                            <EmptyState
                                variant={searchQuery ? "search" : "no-data"}
                                title={searchQuery ? "No graphs match your search" : "No agent graphs yet"}
                                description="Create a new agent graph to start composing ReAct nodes."
                            />
                        )}
                    </div>
                )}
            </div>

            <ConfigExplorerModal
                open={!!inspectTarget}
                onClose={() => setInspectTarget(null)}
                title={inspectTarget ? `Graph: ${String(inspectTarget._id ?? "")}` : undefined}
                subtitle={inspectTarget?.name}
                footerSummary={inspectTarget ? `${nodeCount} nodes • ${edgeCount} edges` : undefined}
            >
                {inspectTarget && (
                    <>
                        <Panel className="p-4">
                            <p className="text-xs text-text-secondary">{inspectTarget.description}</p>
                        </Panel>

                        <ConfigExplorerSection title="Nodes" icon={ListTree} variant="divided">
                            {(Array.isArray(inspectTarget.nodes) ? inspectTarget.nodes : []).map((n: any) => (
                                <ConfigExplorerRow
                                    key={n.id}
                                    title={n.label}
                                    subtitle={`tools: ${Array.isArray(n.react?.toolNames) ? n.react.toolNames.length : 0} • schema: ${n.output?.schemaId ?? "generic_json"}`}
                                    badge={n.id}
                                />
                            ))}
                        </ConfigExplorerSection>

                        <ConfigExplorerSection title="Edges" icon={Wrench} variant="stack">
                            {(Array.isArray(inspectTarget.edges) ? inspectTarget.edges : []).map((e: any) => (
                                <ConfigExplorerMonoBlock key={e.id}>
                                    {e.source} → {e.target}
                                </ConfigExplorerMonoBlock>
                            ))}
                            {(!Array.isArray(inspectTarget.edges) || inspectTarget.edges.length === 0) && (
                                <div className="text-xs text-text-muted">No edges (single node graph).</div>
                            )}
                        </ConfigExplorerSection>
                    </>
                )}
            </ConfigExplorerModal>
        </div>
    );
}
