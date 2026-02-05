"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, Button } from "@numezis/ui/components/design-system";
import type { AuditChain, AuditRun, ChainStatus } from "@numezis/shared/chainTypes";
import { StageDetailModal } from "@numezis/ui/components/StageDetailModal";

interface RunDetailPageProps {
    params: { id: string };
}

export default function RunDetailPage({ params }: RunDetailPageProps) {
    const router = useRouter();
    const [run, setRun] = useState<AuditRun | null>(null);
    const [chain, setChain] = useState<AuditChain | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedStage, setSelectedStage] = useState<{ id: string; name: string; sessionId: string; status: string } | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        void fetchRun();
    }, [params.id]);

    const fetchRun = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/runs/${params.id}`);
            if (!res.ok) throw new Error("Failed to load execution run");
            const data = await res.json();
            setRun(data.run);
            setChain(data.chain);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelRun = async () => {
        if (!run) return;
        const ok = window.confirm(
            "Cancel this run? This will stop the run after the current stage finishes. This action cannot be resumed."
        );
        if (!ok) return;

        setIsCancelling(true);
        try {
            const res = await fetch(`/api/runs/${params.id}/cancel`, { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to cancel run");
            await fetchRun();
        } catch (err: any) {
            alert(err.message || "Failed to cancel run");
        } finally {
            setIsCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
            </div>
        );
    }

    if (error || !run || !chain) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 text-rose-400">Error: {error || "Run not found"}</div>
                <Button onClick={() => router.push("/app/runs")} variant="secondary">Back to Runs</Button>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-bg-app">
            {/* Header */}
            <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-semibold text-text-primary">
                                Execution Run
                            </h1>
                            <StatusBadge status={run.status} />
                        </div>
                        <p className="text-sm text-text-muted">
                            Campaign: <Link href={`/app/campaigns/${run.chainId.toString()}`} className="text-text-secondary hover:text-text-primary hover:underline transition-colors">{chain.name}</Link> · Started {new Date(run.startedAt).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => router.push(`/app/campaigns/${run.chainId}`)}
                        >
                            View Campaign Config
                        </Button>
                        {(run.status === "RUNNING" || run.status === "PAUSED" || run.status === "PENDING") && (
                            <Button
                                onClick={() => void handleCancelRun()}
                                variant="secondary"
                                disabled={isCancelling}
                            >
                                {isCancelling ? "Cancelling..." : "Cancel Run"}
                            </Button>
                        )}
                        {run.status === "COMPLETED" && (
                            <Button onClick={() => window.print()} variant="primary">
                                Print Report
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 text-text-primary">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-4 gap-4">
                            <StatBox label="Findings" value={run.aggregatedFindings.length} />
                            <StatBox label="Claims" value={run.metadata?.totalClaims || 0} />
                            <StatBox label="Verified" value={run.metadata?.totalVerified || 0} />
                            <StatBox label="Status" value={run.status} />
                        </div>

                        {/* Stages View (Simplified) */}
                        <Panel className="p-4">
                            <h2 className="mb-4 text-sm font-semibold text-text-primary">Execution Stages</h2>
                            <div className="space-y-3">
                                {chain.stages.map((stage, index) => {
                                    const isCompleted = index < run.currentStageIndex;
                                    const isCurrent = index === run.currentStageIndex;

                                    const sessionId = run.sessionIds?.[index];

                                    return (
                                        <button
                                            key={stage.id}
                                            onClick={() => {
                                                if (sessionId) {
                                                    setSelectedStage({
                                                        id: stage.id,
                                                        name: stage.name,
                                                        sessionId,
                                                        status: isCompleted ? "Completed" : isCurrent ? "Running" : "Pending"
                                                    });
                                                }
                                            }}
                                            disabled={!sessionId}
                                            className={`w-full text-left flex items-center gap-3 rounded-md border p-3 transition ${isCurrent && run.status === "RUNNING"
                                                ? "border-zinc-400/50 bg-zinc-400/5"
                                                : "border-border-subtle hover:bg-state-hover"
                                                } ${!sessionId ? "cursor-default opacity-50" : "cursor-pointer"}`}
                                        >
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated text-[10px] font-bold">
                                                {isCompleted || (run.status === "COMPLETED" && isCurrent) ? "✅" : index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm font-medium">{stage.name}</div>
                                                    {sessionId && (
                                                        <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle">
                                                            View Logs
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-text-muted font-mono">{stage.graphId}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Panel>

                        {selectedStage && (
                            <StageDetailModal
                                isOpen={!!selectedStage}
                                onClose={() => setSelectedStage(null)}
                                stageId={selectedStage.id}
                                stageName={selectedStage.name}
                                sessionId={selectedStage.sessionId}
                                status={selectedStage.status}
                            />
                        )}

                        {/* Final Report */}
                        {run.finalReport && (
                            <Panel className="p-4">
                                <h2 className="mb-4 text-sm font-semibold text-text-primary">Final Report</h2>
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <pre className="whitespace-pre-wrap rounded-lg bg-bg-elevated p-4 text-xs text-text-secondary leading-relaxed">
                                        {run.finalReport}
                                    </pre>
                                </div>
                            </Panel>
                        )}

                        {/* Findings */}
                        {run.aggregatedFindings.length > 0 && (
                            <Panel className="p-4">
                                <h2 className="mb-4 text-sm font-semibold text-text-primary">Findings ({run.aggregatedFindings.length})</h2>
                                <div className="space-y-4">
                                    {run.aggregatedFindings.map((finding, idx) => (
                                        <div key={idx} className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                                            <div className="flex items-start justify-between">
                                                <h3 className="text-sm font-medium">{finding.type} Finding</h3>
                                                <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase ${finding.type === "BLOQUANT" ? "bg-rose-500/10 text-rose-400" :
                                                    finding.type === "WARNING" ? "bg-zinc-500/10 text-zinc-400" :
                                                        "bg-zinc-400/10 text-zinc-300"
                                                    }`}>
                                                    {finding.type}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-text-muted">{finding.description}</p>
                                            {finding.file && (
                                                <div className="mt-2 text-[10px] font-mono text-text-muted">
                                                    {finding.file}{finding.lineStart ? `:${finding.lineStart}` : ""}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Insights */}
                        {run.crossStageInsights.length > 0 && (
                            <Panel className="p-4">
                                <h2 className="mb-4 text-sm font-semibold text-text-primary">Cross-Stage Insights</h2>
                                <div className="space-y-3">
                                    {run.crossStageInsights.map((insight, idx) => (
                                        <div key={idx} className="rounded-md border border-border-subtle p-3">
                                            <div className="text-xs font-medium">{insight.title}</div>
                                            <p className="mt-1 text-[10px] text-text-muted">{insight.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        )}

                        {/* Run Metadata */}
                        <Panel className="p-4">
                            <h2 className="mb-4 text-sm font-semibold text-text-primary">Run Metadata</h2>
                            <div className="space-y-4 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-text-muted">Run ID</span>
                                    <span className="font-mono text-text-secondary">{run._id?.toString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-text-muted">Campaign ID</span>
                                    <Link
                                        href={`/app/campaigns/${run.chainId.toString()}`}
                                        className="font-mono text-text-secondary hover:text-text-primary hover:underline decoration-text-muted/50 underline-offset-2 transition-colors"
                                    >
                                        {run.chainId.toString()}
                                    </Link>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Started</span>
                                    <span className="text-text-secondary">{new Date(run.startedAt).toLocaleString()}</span>
                                </div>
                                {run.endedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Ended</span>
                                        <span className="text-text-secondary">{new Date(run.endedAt).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Total Stages</span>
                                    <span className="text-text-secondary">{chain.stages.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Last Active Stage</span>
                                    <span className="text-text-secondary"># {run.currentStageIndex + 1}</span>
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
            <div className="mt-1 text-base font-semibold text-text-primary">{value}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: ChainStatus }) {
    const styles: Record<ChainStatus, string> = {
        COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        RUNNING: "bg-zinc-400/10 text-zinc-300 border-zinc-400/20",
        PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
        PAUSED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        CANCELLED: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
    };

    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
        >
            {status === "RUNNING" && (
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {status}
        </span>
    );
}
