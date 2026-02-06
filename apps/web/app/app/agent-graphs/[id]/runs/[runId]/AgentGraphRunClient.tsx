"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Panel, Skeleton } from "@numezis/ui/components/design-system";

type AgentGraphDto = {
    _id?: string;
    name: string;
    nodes: Array<{ id: string; label: string }>;
};

type AgentGraphRunDto = {
    _id?: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    startedAt?: string;
    endedAt?: string;
    nodeOrder?: string[];
    nodeStatuses?: Record<string, "PENDING" | "RUNNING" | "COMPLETED" | "FAILED">;
    nodeSessionIds?: Record<string, string>;
    state?: any;
    error?: string;
};

type ApprovalItem = {
    id: string;
    toolName: string;
    args?: Record<string, any>;
    status?: string;
    createdAt?: string;
    description?: string;
    executedAt?: string;
    rejectedAt?: string;
    result?: string;
    evictedPath?: string;
};

function StatusBadge({ status }: { status: AgentGraphRunDto["status"] | string }) {
    const styles: Record<string, string> = {
        COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        RUNNING: "bg-zinc-400/10 text-zinc-300 border-zinc-400/20",
        PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
    };
    const cls = styles[status] ?? styles.PENDING;
    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
        >
            {status === "RUNNING" && <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
            {status}
        </span>
    );
}

export default function AgentGraphRunClient({ params }: { params: { id: string; runId: string } }) {
    const router = useRouter();
    const [graph, setGraph] = useState<AgentGraphDto | null>(null);
    const [run, setRun] = useState<AgentGraphRunDto | null>(null);
    const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
    const [approvalsLoading, setApprovalsLoading] = useState(false);
    const [approvalsError, setApprovalsError] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        void loadInitial();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id, params.runId]);

    useEffect(() => {
        if (!run) return;
        if (run.status !== "RUNNING" && run.status !== "PENDING") return;
        const t = window.setInterval(() => {
            void fetchRun();
            void fetchApprovals();
        }, 1500);
        return () => window.clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run?.status, params.runId]);

    const loadInitial = async () => {
        setLoading(true);
        setError("");
        try {
            await Promise.all([fetchGraph(), fetchRun(), fetchApprovals()]);
        } catch (err: any) {
            setError(err.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    const fetchGraph = async () => {
        const res = await fetch(`/api/agent-graphs/${params.id}`);
        if (!res.ok) throw new Error("Failed to load graph");
        const data = await res.json();
        setGraph(data.graph);
    };

    const fetchRun = async () => {
        const res = await fetch(`/api/agent-graph-runs/${params.runId}`);
        if (!res.ok) throw new Error("Failed to load run");
        const data = await res.json();
        setRun(data.run);
    };

    const fetchApprovals = async () => {
        setApprovalsLoading(true);
        setApprovalsError("");
        try {
            const res = await fetch(`/api/agent-graph-runs/${params.runId}/approvals`);
            if (!res.ok) throw new Error("Failed to load approvals");
            const data = await res.json();
            setPendingApprovals(Array.isArray(data.pending) ? data.pending : []);
        } catch (err: any) {
            setApprovalsError(err.message || "Failed to load approvals");
        } finally {
            setApprovalsLoading(false);
        }
    };

    const handleApprovalAction = async (action: "approve" | "reject" | "approve_all" | "reject_all", id?: string) => {
        try {
            const res = await fetch(`/api/agent-graph-runs/${params.runId}/approvals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, id }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? "Failed to update approval");
            }
            await Promise.all([fetchRun(), fetchApprovals()]);
        } catch (err: any) {
            setApprovalsError(err.message || "Approval failed");
        }
    };

    const nodeLabelById = useMemo(() => {
        const map = new Map<string, string>();
        for (const n of graph?.nodes ?? []) map.set(n.id, n.label);
        return map;
    }, [graph?.nodes]);

    const orderedNodeIds = useMemo(() => {
        const ids = run?.nodeOrder?.length ? run.nodeOrder : (graph?.nodes ?? []).map((n) => n.id);
        return ids;
    }, [run?.nodeOrder, graph?.nodes]);

    const grantedApprovals: ApprovalItem[] = Array.isArray(run?.state?.approvals?.granted)
        ? run?.state?.approvals?.granted
        : [];
    const rejectedApprovals: ApprovalItem[] = Array.isArray(run?.state?.approvals?.rejected)
        ? run?.state?.approvals?.rejected
        : [];
    const plan = run?.state?.plan;
    const taskQueue: Array<{ id?: string; title?: string; status?: string }> = Array.isArray(run?.state?.taskQueue)
        ? run?.state?.taskQueue
        : [];
    const currentTaskId = typeof run?.state?.currentTaskId === "string" ? run?.state?.currentTaskId : "";

    if (loading && !run) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-[520px] w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="p-6 text-rose-400">Error: {error}</div>;
    }

    if (!graph || !run) return null;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/app/agent-graphs/${params.id}`)}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-text-muted hover:bg-state-hover hover:text-text-primary"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-primary">
                            {graph.name} — Run {params.runId.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                            <StatusBadge status={run.status} />
                            {run.startedAt && <span>started {new Date(run.startedAt).toLocaleString()}</span>}
                            {run.endedAt && <span>ended {new Date(run.endedAt).toLocaleString()}</span>}
                        </div>
                    </div>
                </div>
                <Link href={`/app/agent-graphs/${params.id}`}>
                    <Button variant="secondary">Open editor</Button>
                </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-elegant p-6">
                {run.error && (
                    <Panel className="mb-4 border-rose-500/20 bg-rose-500/10 p-4">
                        <div className="text-sm font-semibold text-rose-300">Run failed</div>
                        <div className="mt-1 text-xs text-rose-300">{run.error}</div>
                    </Panel>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Panel className="p-4">
                        <div className="text-sm font-semibold text-text-primary">Nodes</div>
                        <div className="mt-3 space-y-2">
                            {orderedNodeIds.map((nodeId) => {
                                const status = run.nodeStatuses?.[nodeId] ?? "PENDING";
                                const sessionId = run.nodeSessionIds?.[nodeId];
                                return (
                                    <div
                                        key={nodeId}
                                        className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-text-primary">
                                                {nodeLabelById.get(nodeId) ?? nodeId}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                                                <StatusBadge status={status} />
                                                <span className="font-mono">{nodeId}</span>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="secondary" disabled={!sessionId}>
                                            Session
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>

                    <Panel className="p-4">
                        <div className="text-sm font-semibold text-text-primary">Current state</div>
                        <div className="mt-3">
                            <pre className="max-h-[520px] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-bg-elevated p-3 text-xs font-mono text-text-secondary scrollbar-elegant">
                                {JSON.stringify(run.state ?? {}, null, 2)}
                            </pre>
                        </div>
                    </Panel>
                </div>

                <Panel className="mt-4 p-4">
                    <div className="text-sm font-semibold text-text-primary">Plan & Task Queue</div>
                    <div className="mt-3 space-y-3">
                        <div className="text-xs text-text-muted">Current task</div>
                        <div className="text-sm font-mono text-text-primary">{currentTaskId || "—"}</div>

                        <div className="text-xs text-text-muted">Plan</div>
                        <pre className="max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-bg-elevated p-3 text-xs font-mono text-text-secondary scrollbar-elegant">
                            {plan ? JSON.stringify(plan, null, 2) : "No plan yet."}
                        </pre>

                        <div className="text-xs text-text-muted">Task queue</div>
                        {taskQueue.length ? (
                            <div className="space-y-2">
                                {taskQueue.map((task, index) => {
                                    const status = task.status ?? "todo";
                                    const isCurrent = currentTaskId && task.id === currentTaskId;
                                    return (
                                        <div
                                            key={task.id ?? task.title ?? `task-${index}`}
                                            className={`rounded-md border px-3 py-2 text-xs ${isCurrent ? "border-emerald-500/30 bg-emerald-500/10" : "border-border-subtle bg-bg-surface"}`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium text-text-primary">
                                                        {task.title ?? task.id ?? "Untitled task"}
                                                    </div>
                                                    <div className="mt-0.5 text-[11px] text-text-muted">
                                                        {task.id ?? "no-id"}
                                                    </div>
                                                </div>
                                                <span className="rounded-md border border-border-subtle px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                                                    {status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-xs text-text-muted">No tasks yet.</div>
                        )}
                    </div>
                </Panel>

                <Panel className="mt-4 p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-text-primary">Approvals</div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={pendingApprovals.length === 0 || approvalsLoading}
                                onClick={() => void handleApprovalAction("approve_all")}
                            >
                                Approve all
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={pendingApprovals.length === 0 || approvalsLoading}
                                onClick={() => void handleApprovalAction("reject_all")}
                            >
                                Reject all
                            </Button>
                        </div>
                    </div>

                    {approvalsError && (
                        <div className="mt-2 text-xs text-rose-300">{approvalsError}</div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div>
                            <div className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                                Pending ({pendingApprovals.length})
                            </div>
                            <div className="mt-2 space-y-2">
                                {pendingApprovals.length === 0 && (
                                    <div className="text-xs text-text-muted">No pending approvals.</div>
                                )}
                                {pendingApprovals.map((item) => (
                                    <div key={item.id} className="rounded-md border border-border-subtle bg-bg-surface p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs font-semibold text-text-primary">
                                                {item.toolName}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="xs"
                                                    variant="secondary"
                                                    onClick={() => void handleApprovalAction("reject", item.id)}
                                                >
                                                    Reject
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    variant="primary"
                                                    onClick={() => void handleApprovalAction("approve", item.id)}
                                                >
                                                    Approve
                                                </Button>
                                            </div>
                                        </div>
                                        {item.description && (
                                            <div className="mt-1 text-[11px] text-text-muted">{item.description}</div>
                                        )}
                                        {item.args && (
                                            <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border-subtle bg-bg-elevated p-2 text-[10px] font-mono text-text-secondary">
                                                {JSON.stringify(item.args, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                                Executed / Rejected
                            </div>
                            <div className="mt-2 space-y-2">
                                {grantedApprovals.map((item) => (
                                    <div key={item.id} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                                        <div className="text-xs font-semibold text-emerald-300">{item.toolName}</div>
                                        {item.executedAt && (
                                            <div className="mt-1 text-[10px] text-emerald-300">
                                                Executed {new Date(item.executedAt).toLocaleString()}
                                            </div>
                                        )}
                                        {item.result && (
                                            <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border-subtle bg-bg-elevated p-2 text-[10px] font-mono text-text-secondary">
                                                {item.result}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                                {rejectedApprovals.map((item) => (
                                    <div key={item.id} className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                                        <div className="text-xs font-semibold text-rose-300">{item.toolName}</div>
                                        {item.rejectedAt && (
                                            <div className="mt-1 text-[10px] text-rose-300">
                                                Rejected {new Date(item.rejectedAt).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {grantedApprovals.length === 0 && rejectedApprovals.length === 0 && (
                                    <div className="text-xs text-text-muted">No executed approvals yet.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>

        </div>
    );
}
