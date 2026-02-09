"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayCircle, Trash2 } from "lucide-react";

import { AgentGraphEditor } from "@numezis/ui/components/agentGraphs/AgentGraphEditor";
import { Button, Skeleton } from "@numezis/ui/components/design-system";

type AgentGraphDto = {
    _id?: string;
    name: string;
    description?: string;
    nodes: any[];
    edges: any[];
    category?: "deep_agent" | "graph" | "campaign" | "drift";
};

type HistoryRunItem = {
    id: string;
    type: "explore" | "deep_agent" | "graph" | "campaign" | "drift";
    title: string;
    status: string;
    startedAt: string;
    endedAt?: string | null;
    link: string;
    graphId?: string;
    graphName?: string;
    campaignId?: string;
    workspaceId: string;
};

export default function AgentGraphDetailClient({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [graph, setGraph] = useState<AgentGraphDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [recentRuns, setRecentRuns] = useState<HistoryRunItem[]>([]);
    const [recentRunsLoading, setRecentRunsLoading] = useState(false);
    const [recentRunsError, setRecentRunsError] = useState("");

    useEffect(() => {
        void fetchGraph();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    const fetchGraph = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/agent-graphs/${params.id}`);
            if (!res.ok) throw new Error("Failed to load graph");
            const data = await res.json();
            setGraph(data.graph);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const historyType = useMemo(() => {
        if (graph?.category === "deep_agent") return "deep_agent";
        if (graph?.category === "campaign") return "campaign";
        if (graph?.category === "drift") return "drift";
        return "graph";
    }, [graph?.category]);

    const fetchRecentRuns = useCallback(async () => {
        setRecentRunsLoading(true);
        setRecentRunsError("");
        try {
            const paramsObj = new URLSearchParams();
            paramsObj.set("graphId", params.id);
            paramsObj.set("type", historyType);
            paramsObj.set("limit", "12");
            const res = await fetch(`/api/history/runs?${paramsObj.toString()}`);
            if (!res.ok) throw new Error("Failed to load runs");
            const data = (await res.json()) as { runs: HistoryRunItem[] };
            setRecentRuns(Array.isArray(data.runs) ? data.runs : []);
        } catch (err: any) {
            setRecentRunsError(err?.message || "Failed to load runs");
        } finally {
            setRecentRunsLoading(false);
        }
    }, [historyType, params.id]);

    useEffect(() => {
        if (!graph) return;
        void fetchRecentRuns();
    }, [graph, fetchRecentRuns]);

    const handleRun = async () => {
        try {
            const res = await fetch(`/api/agent-graphs/${params.id}/runs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mission: "" }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to start run");
            }
            const data = await res.json();
            router.push(`/app/agent-graphs/${params.id}/runs/${data.runId}`);
        } catch (err: any) {
            alert(err.message || "Failed to start run");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this agent graph?")) return;

        try {
            const res = await fetch(`/api/agent-graphs/${params.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete graph");
            }
            router.push("/app/agent-graphs");
        } catch (err: any) {
            alert(err.message || "Failed to delete graph");
        }
    };

    if (loading && !graph) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[520px] w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="p-6 text-status-error-text">Error: {error}</div>;
    }

    if (!graph) return null;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-3">
                <div className="text-sm text-text-muted">Agent graph editor</div>
                <div className="flex gap-2">
                    <Button variant="danger" onClick={() => void handleDelete()}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </Button>
                    <Button onClick={() => void handleRun()}>
                        <PlayCircle className="h-4 w-4" />
                        Run
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                <div className="flex-1 min-h-0">
                    <AgentGraphEditor graphId={params.id} initialGraph={graph as any} />
                </div>
                <aside className="w-[320px] border-l border-border-subtle bg-bg-surface">
                    <section className="flex h-full flex-col">
                        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                            <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                Run History
                            </h2>
                            <Link
                                href={`/app/history?type=${historyType}&graphId=${encodeURIComponent(params.id)}`}
                                className="text-[10px] font-semibold text-text-muted hover:text-text-primary"
                            >
                                View all
                            </Link>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-elegant">
                            {recentRunsLoading && (
                                <div className="text-[11px] text-text-muted">Loading history…</div>
                            )}
                            {!recentRunsLoading && recentRunsError && (
                                <div className="text-[11px] text-status-error-text">{recentRunsError}</div>
                            )}
                            {!recentRunsLoading && !recentRunsError && recentRuns.length === 0 && (
                                <div className="text-[11px] text-text-muted">No runs yet.</div>
                            )}
                            {!recentRunsLoading &&
                                !recentRunsError &&
                                recentRuns.map((run) => (
                                    <Link
                                        key={run.id}
                                        href={run.link}
                                        className="block rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="truncate font-semibold text-text-primary">{run.title}</div>
                                            <span className="text-[10px] text-text-muted">{run.status}</span>
                                        </div>
                                        <div className="mt-1 text-[10px] text-text-muted">
                                            {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                                        </div>
                                    </Link>
                                ))}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
