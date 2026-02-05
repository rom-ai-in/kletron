"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, Button } from "@numezis/ui/components/design-system";
import type { AuditChain, AuditRun, ChainStatus } from "@numezis/shared/chainTypes";
import type { AgentEvent } from "@numezis/shared/types";
import { StageDetailModal } from "@numezis/ui/components/StageDetailModal";

interface RunDetailPageProps {
    params: { id: string };
}

const POLL_INTERVAL_MS = 4000;

export default function RunDetailPage({ params }: RunDetailPageProps) {
    const router = useRouter();
    const [run, setRun] = useState<AuditRun | null>(null);
    const [chain, setChain] = useState<AuditChain | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [refreshError, setRefreshError] = useState("");
    const [selectedStage, setSelectedStage] = useState<{ id: string; name: string; sessionId: string; status: string } | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
    const [liveStageId, setLiveStageId] = useState<string | null>(null);
    const [liveStageName, setLiveStageName] = useState<string | null>(null);
    const [liveEvents, setLiveEvents] = useState<AgentEvent[]>([]);
    const [liveLoading, setLiveLoading] = useState(false);
    const [liveError, setLiveError] = useState("");
    const [liveLastUpdated, setLiveLastUpdated] = useState<string | null>(null);
    const [autoOpenedSessionId, setAutoOpenedSessionId] = useState<string | null>(null);

    const pickLiveSession = (runData: AuditRun, chainData: AuditChain | null) => {
        const stageCount = chainData?.stages?.length ?? 0;
        const safeStageCount = stageCount > 0 ? stageCount : runData.sessionIds?.length ?? 0;
        if (!safeStageCount) return { sessionId: null, stageName: null, stageId: null };

        const currentIndexRaw = typeof runData.currentStageIndex === "number" ? runData.currentStageIndex : 0;
        const currentIndex = Math.min(Math.max(currentIndexRaw, 0), safeStageCount - 1);
        let candidateIndex = (runData.sessionIds?.length ?? 0) > 0 ? (runData.sessionIds?.length ?? 1) - 1 : undefined;
        if (runData.status === "RUNNING" || runData.status === "PAUSED" || runData.status === "PENDING") {
            if (runData.sessionIds?.[currentIndex]) {
                candidateIndex = currentIndex;
            }
        }
        if (candidateIndex === undefined) {
            return { sessionId: null, stageName: null, stageId: null };
        }

        const sessionId = runData.sessionIds?.[candidateIndex] ?? null;
        const stage = chainData?.stages?.[candidateIndex];
        const stageName = stage?.name ?? (sessionId ? `Stage ${candidateIndex + 1}` : null);
        const stageId = stage?.id ?? null;
        return { sessionId, stageName, stageId };
    };

    const fetchLiveLogs = async (sessionId: string, background = false) => {
        if (!sessionId) return;
        if (!background) {
            setLiveLoading(true);
            setLiveError("");
        }
        try {
            const res = await fetch(`/api/audits/${sessionId}`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load stage logs");
            const data = await res.json();
            const stream = data.eventStream || data.workflowResult?.eventStream;
            const events = Array.isArray(stream) ? (stream as AgentEvent[]) : [];
            setLiveEvents(events);
            if (data?.lastUpdated) {
                setLiveLastUpdated(data.lastUpdated);
            }
        } catch (err: any) {
            setLiveError(err?.message || "Unknown error");
        } finally {
            if (!background) {
                setLiveLoading(false);
            }
        }
    };

    useEffect(() => {
        void fetchRun();
    }, [params.id]);

    useEffect(() => {
        if (!run) return;
        if (run.status === "RUNNING" || run.status === "PENDING" || run.status === "PAUSED") {
            const interval = setInterval(() => {
                void fetchRun({ background: true });
            }, POLL_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [run?.status, params.id]);

    useEffect(() => {
        if (!run) return;
        const { sessionId, stageName, stageId } = pickLiveSession(run, chain);
        setLiveSessionId(sessionId);
        setLiveStageName(stageName);
        setLiveStageId(stageId);
        if (sessionId) {
            void fetchLiveLogs(sessionId);
        } else {
            setLiveEvents([]);
        }
    }, [run?.currentStageIndex, run?.status, run?.sessionIds?.length, chain?.stages?.length]);

    useEffect(() => {
        if (!liveSessionId) return;
        if (run?.status === "RUNNING" || run?.status === "PENDING" || run?.status === "PAUSED") {
            const interval = setInterval(() => {
                void fetchLiveLogs(liveSessionId, true);
            }, POLL_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [liveSessionId, run?.status]);

    useEffect(() => {
        if (!liveSessionId) return;
        if (autoOpenedSessionId === liveSessionId) return;
        if (run?.status === "RUNNING" || run?.status === "PENDING" || run?.status === "PAUSED") {
            setSelectedStage({
                id: liveStageId || liveSessionId,
                name: liveStageName || "Current Stage",
                sessionId: liveSessionId,
                status: run.status,
            });
            setAutoOpenedSessionId(liveSessionId);
        }
    }, [liveSessionId, autoOpenedSessionId, run?.status, liveStageId, liveStageName]);

    const fetchRun = async ({ background = false }: { background?: boolean } = {}) => {
        if (background) {
            setRefreshing(true);
            setRefreshError("");
        } else {
            setLoading(true);
            setError("");
        }
        try {
            const res = await fetch(`/api/runs/${params.id}`);
            if (!res.ok) throw new Error("Failed to load execution run");
            const data = await res.json();
            setRun(data.run);
            setChain(data.chain);
        } catch (err: any) {
            if (background) {
                setRefreshError(err.message || "Unknown error");
            } else {
                setError(err.message || "Unknown error");
            }
        } finally {
            if (background) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
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
            await fetchRun({ background: true });
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
                            {refreshing && (
                                <span className="text-[10px] text-text-muted">Updating…</span>
                            )}
                            {refreshError && !refreshing && (
                                <span className="text-[10px] text-rose-400">Live update failed</span>
                            )}
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
                                    const currentIndex = Math.min(run.currentStageIndex, Math.max(chain.stages.length - 1, 0));
                                    const isCompleted = run.status === "COMPLETED" || index < currentIndex;
                                    const isCurrent = index === currentIndex && (run.status === "RUNNING" || run.status === "PAUSED" || run.status === "PENDING");
                                    const stageStatus: ChainStatus = isCompleted
                                        ? "COMPLETED"
                                        : isCurrent
                                        ? run.status
                                        : "PENDING";

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
                                                        status: stageStatus
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
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm font-medium">{stage.name}</div>
                                                    <div className="flex items-center gap-2">
                                                        {isCurrent && sessionId && (
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 hover:border-emerald-400/60 hover:text-emerald-200"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setSelectedStage({
                                                                        id: stage.id,
                                                                        name: stage.name,
                                                                        sessionId,
                                                                        status: stageStatus
                                                                    });
                                                                }}
                                                                title="Open live logs"
                                                            >
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                                                Live
                                                            </button>
                                                        )}
                                                        <StatusBadge status={stageStatus} />
                                                        {sessionId && (
                                                            <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle">
                                                                Logs
                                                            </span>
                                                        )}
                                                    </div>
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

                        <Panel className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-text-primary">Live Logs</h2>
                                    <p className="text-xs text-text-muted">
                                        {liveStageName ? `Current stage: ${liveStageName}` : (run.status === "RUNNING" ? "Waiting for stage logs..." : "No active stage yet")}
                                    </p>
                                    {liveLastUpdated && (
                                        <p className="text-[10px] text-text-muted">
                                            Last update: {new Date(liveLastUpdated).toLocaleTimeString()}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            if (liveSessionId) {
                                                void fetchLiveLogs(liveSessionId);
                                            }
                                        }}
                                        disabled={!liveSessionId}
                                    >
                                        Refresh
                                    </Button>
                                    {liveSessionId && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => {
                                                setSelectedStage({
                                                    id: liveStageId || liveSessionId,
                                                    name: liveStageName || "Current Stage",
                                                    sessionId: liveSessionId,
                                                    status: run.status
                                                });
                                            }}
                                        >
                                            Open Full Logs
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {liveLoading && (
                                <div className="text-xs text-text-muted">Loading logs...</div>
                            )}
                            {liveError && (
                                <div className="text-xs text-rose-400">Error: {liveError}</div>
                            )}
                            {!liveLoading && !liveError && !liveSessionId && run.status === "RUNNING" && (
                                <div className="text-xs text-amber-300">
                                    No session yet. If this run started before the live-logs update, cancel and restart the run.
                                </div>
                            )}
                            {!liveLoading && !liveError && liveEvents.length === 0 && (
                                <div className="text-xs text-text-muted">No events yet.</div>
                            )}
                            {!liveLoading && !liveError && liveEvents.length > 0 && (
                                <div className="space-y-2">
                                    {liveEvents.slice(-6).map((event) => (
                                        <div key={event.id} className="text-[11px] text-text-secondary font-mono line-clamp-1">
                                            {new Date(event.timestamp).toLocaleTimeString()} • {event.phaseLabel || event.phaseId || event.kind.toUpperCase()}: {event.kind === "tool"
                                                ? `${event.toolName || event.name || "tool"} ${event.toolArgs ? `→ ${String(event.toolArgs).slice(0, 120)}` : ""}`
                                                : (event.content || event.toolOutput || event.toolArgs || "")}
                                        </div>
                                    ))}
                                    {liveEvents.length > 6 && (
                                        <div className="text-[10px] text-text-muted">Showing last 6 events</div>
                                    )}
                                </div>
                            )}
                        </Panel>

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
