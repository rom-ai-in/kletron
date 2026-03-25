"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, Button } from "@kletron/ui/components/design-system";
import type { AutomationDefinition, AutomationRun, AutomationStatus, PersistedStageResult } from "@kletron/shared/automationTypes";
import type { AgentEvent } from "@kletron/shared/types";
import { StageDetailModal } from "@kletron/ui/components/StageDetailModal";
import { FindingsExplorer } from "@kletron/ui/components/FindingsExplorer";
import { ReportMarkdownRenderer } from "@kletron/ui/components/ReportMarkdownRenderer";
import { ChevronDown, ChevronRight, Clock, FileText, BarChart3, Layers, Search as SearchIcon, Download } from "lucide-react";

interface RunDetailPageProps {
    params: { id: string };
}

const POLL_INTERVAL_MS = 4000;

type TabId = "overview" | "stages" | "findings" | "report";

export default function RunDetailPage({ params }: RunDetailPageProps) {
    const router = useRouter();
    const [run, setRun] = useState<AutomationRun | null>(null);
    const [automation, setAutomation] = useState<AutomationDefinition | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [refreshError, setRefreshError] = useState("");
    const [selectedStage, setSelectedStage] = useState<{ id: string; name: string; sessionId: string; status: string } | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>("overview");

    // Live logs state
    const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
    const [liveStageId, setLiveStageId] = useState<string | null>(null);
    const [liveStageName, setLiveStageName] = useState<string | null>(null);
    const [liveEvents, setLiveEvents] = useState<AgentEvent[]>([]);
    const [liveLoading, setLiveLoading] = useState(false);
    const [liveError, setLiveError] = useState("");
    const [liveLastUpdated, setLiveLastUpdated] = useState<string | null>(null);
    const [autoOpenedSessionId, setAutoOpenedSessionId] = useState<string | null>(null);

    // Expanded stages for accordion
    const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

    const pickLiveSession = (runData: AutomationRun, automationData: AutomationDefinition | null) => {
        const stageCount = automationData?.stages?.length ?? 0;
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
        const stage = automationData?.stages?.[candidateIndex];
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
        const { sessionId, stageName, stageId } = pickLiveSession(run, automation);
        setLiveSessionId(sessionId);
        setLiveStageName(stageName);
        setLiveStageId(stageId);
        if (sessionId) {
            void fetchLiveLogs(sessionId);
        } else {
            setLiveEvents([]);
        }
    }, [run?.currentStageIndex, run?.status, run?.sessionIds?.length, automation?.stages?.length]);

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
            setAutomation(data.automation);
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

    const handleExportMarkdown = () => {
        if (!run?.finalReport) return;
        const blob = new Blob([run.finalReport], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `run-${params.id.slice(0, 8)}-report.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleStage = (idx: number) => {
        setExpandedStages((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
            </div>
        );
    }

    if (error || !run || !automation) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 text-status-error-text">Error: {error || "Run not found"}</div>
                <Button onClick={() => router.push("/app/runs")} variant="secondary">Back to Runs</Button>
            </div>
        );
    }

    const stageResults: PersistedStageResult[] = (run as any).stageResults || [];

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
                                <span className="text-[10px] text-status-error-text">Live update failed</span>
                            )}
                        </div>
                        <p className="text-sm text-text-muted">
                            Automation: <Link href={`/app/automations/${run.chainId.toString()}`} className="text-text-secondary hover:text-text-primary hover:underline transition-colors">{automation.name}</Link> · Started {new Date(run.startedAt).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => router.push(`/app/automations/${run.chainId}`)}
                        >
                            View Automation Config
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

            {/* Tabs */}
            <div className="flex items-center border-b border-border-subtle bg-bg-surface px-6">
                {([
                    { id: "overview" as TabId, label: "Overview", icon: BarChart3 },
                    { id: "stages" as TabId, label: "Stages", icon: Layers },
                    { id: "findings" as TabId, label: `Findings (${run.aggregatedFindings.length})`, icon: SearchIcon },
                    { id: "report" as TabId, label: "Report", icon: FileText },
                ]).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                            activeTab === id
                                ? "border-text-primary text-text-primary"
                                : "border-transparent text-text-muted hover:text-text-secondary"
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 text-text-primary">
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

                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <StatBox label="Findings" value={run.aggregatedFindings.length} />
                            <StatBox label="Claims" value={run.metadata?.totalClaims || 0} />
                            <StatBox label="Verified" value={run.metadata?.totalVerified || 0} />
                            <StatBox label="Status" value={run.status} />
                        </div>

                        {/* Execution Stages Timeline */}
                        <Panel className="p-4">
                            <h2 className="mb-4 text-sm font-semibold text-text-primary">Execution Stages</h2>
                            <div className="space-y-3">
                                {automation.stages.map((stage, index) => {
                                    const currentIndex = Math.min(run.currentStageIndex, Math.max(automation.stages.length - 1, 0));
                                    const isCompleted = run.status === "COMPLETED" || index < currentIndex;
                                    const isCurrent = index === currentIndex && (run.status === "RUNNING" || run.status === "PAUSED" || run.status === "PENDING");
                                    const stageStatus: AutomationStatus = isCompleted
                                        ? "COMPLETED"
                                        : isCurrent
                                        ? run.status
                                        : "PENDING";

                                    const sessionId = run.sessionIds?.[index];
                                    const stageResult = stageResults[index];
                                    const duration = stageResult?.duration ? `${(stageResult.duration / 1000 / 60).toFixed(1)}m` : "";
                                    const findingsCount = stageResult?.findingsCount ?? 0;

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
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated text-[10px] font-bold flex-none">
                                                {isCompleted || (run.status === "COMPLETED") ? (
                                                    <span className="text-status-success-text">✓</span>
                                                ) : (
                                                    index + 1
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm font-medium truncate">{stage.name}</div>
                                                    <div className="flex items-center gap-2 flex-none">
                                                        {duration && (
                                                            <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {duration}
                                                            </span>
                                                        )}
                                                        {findingsCount > 0 && (
                                                            <span className="rounded bg-zinc-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                                                                {findingsCount} findings
                                                            </span>
                                                        )}
                                                        {isCurrent && sessionId && (
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-1 rounded border border-status-success-border bg-status-success-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-success-text hover:border-status-success-border hover:text-status-success-text"
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
                                                                <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
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

                        {/* Live Logs */}
                        <Panel className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-text-primary">Live Logs</h2>
                                    <p className="text-xs text-text-muted">
                                        {liveStageName ? `Current stage: ${liveStageName}` : (run.status === "RUNNING" ? "Waiting for stage logs..." : "No active stage")}
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
                                <div className="text-xs text-status-error-text">Error: {liveError}</div>
                            )}
                            {!liveLoading && !liveError && !liveSessionId && run.status === "RUNNING" && (
                                <div className="text-xs text-status-warning-text">
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

                        {/* Cross-Stage Insights */}
                        {run.crossStageInsights.length > 0 && (
                            <Panel className="p-4">
                                <h2 className="mb-4 text-sm font-semibold text-text-primary">Cross-Stage Insights</h2>
                                <div className="space-y-3">
                                    {run.crossStageInsights.map((insight, idx) => (
                                        <div key={idx} className="rounded-md border border-border-subtle p-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                                    insight.priority === "CRITICAL" ? "bg-red-500/15 text-red-400" :
                                                    insight.priority === "HIGH" ? "bg-amber-500/15 text-amber-400" :
                                                    "bg-zinc-400/10 text-zinc-400"
                                                }`}>
                                                    {insight.type}
                                                </span>
                                                <span className="text-xs font-medium text-text-primary">{insight.title}</span>
                                            </div>
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
                                    <span className="text-text-muted">Automation ID</span>
                                    <Link
                                        href={`/app/automations/${run.chainId.toString()}`}
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
                                    <span className="text-text-secondary">{automation.stages.length}</span>
                                </div>
                                {run.metadata?.totalDuration && (
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Total Duration</span>
                                        <span className="text-text-secondary">{(run.metadata.totalDuration / 1000 / 60).toFixed(1)}m</span>
                                    </div>
                                )}
                            </div>
                        </Panel>
                    </div>
                )}

                {/* STAGES TAB */}
                {activeTab === "stages" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-text-primary">Stage Outputs</h2>
                            <span className="text-[10px] text-text-muted">{automation.stages.length} stages</span>
                        </div>
                        {automation.stages.map((stage, index) => {
                            const stageResult = stageResults[index];
                            const isExpanded = expandedStages.has(index);
                            const sessionId = run.sessionIds?.[index];
                            const currentIndex = Math.min(run.currentStageIndex, Math.max(automation.stages.length - 1, 0));
                            const isCompleted = run.status === "COMPLETED" || index < currentIndex;
                            const stageStatus: AutomationStatus = isCompleted ? "COMPLETED" : "PENDING";
                            const hasOutput = stageResult?.rawOutput && stageResult.rawOutput.length > 0;

                            return (
                                <Panel key={stage.id} className="overflow-hidden">
                                    {/* Stage header */}
                                    <button
                                        onClick={() => toggleStage(index)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-state-hover transition"
                                    >
                                        {isExpanded ? <ChevronDown className="h-4 w-4 text-text-muted flex-none" /> : <ChevronRight className="h-4 w-4 text-text-muted flex-none" />}
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated text-[10px] font-bold flex-none">
                                            {isCompleted ? <span className="text-status-success-text">✓</span> : index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-text-primary truncate">{stage.name}</span>
                                                <div className="flex items-center gap-2 flex-none">
                                                    {stageResult?.duration && (
                                                        <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {(stageResult.duration / 1000 / 60).toFixed(1)}m
                                                        </span>
                                                    )}
                                                    {(stageResult?.findingsCount ?? 0) > 0 && (
                                                        <span className="rounded bg-zinc-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                                                            {stageResult!.findingsCount} findings
                                                        </span>
                                                    )}
                                                    <StatusBadge status={stageResult?.success ? "COMPLETED" : stageResult?.error ? "FAILED" : stageStatus} />
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Stage content */}
                                    {isExpanded && (
                                        <div className="border-t border-border-subtle">
                                            {/* Action buttons */}
                                            <div className="flex items-center gap-2 px-4 py-2 bg-bg-elevated/30 border-b border-border-subtle">
                                                {sessionId && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => setSelectedStage({
                                                            id: stage.id,
                                                            name: stage.name,
                                                            sessionId,
                                                            status: stageStatus
                                                        })}
                                                    >
                                                        View Execution Logs
                                                    </Button>
                                                )}
                                                {stageResult?.error && (
                                                    <span className="text-[10px] text-status-error-text">Error: {stageResult.error}</span>
                                                )}
                                            </div>

                                            {/* Raw output rendered as markdown */}
                                            {hasOutput ? (
                                                <div className="px-4 py-4 max-h-[600px] overflow-y-auto scrollbar-elegant">
                                                    <ReportMarkdownRenderer content={stageResult!.rawOutput!} />
                                                </div>
                                            ) : (
                                                <div className="px-4 py-6 text-center text-xs text-text-muted">
                                                    {stageResult ? "No output captured for this stage." : "Stage has not been executed yet."}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Panel>
                            );
                        })}
                    </div>
                )}

                {/* FINDINGS TAB */}
                {activeTab === "findings" && (
                    <FindingsExplorer
                        findings={run.aggregatedFindings}
                        stages={automation.stages.map((s) => ({ id: s.id, name: s.name }))}
                    />
                )}

                {/* REPORT TAB */}
                {activeTab === "report" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-text-primary">Final Report</h2>
                            {run.finalReport && (
                                <Button size="sm" variant="secondary" onClick={handleExportMarkdown}>
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Export Markdown
                                </Button>
                            )}
                        </div>
                        {run.finalReport ? (
                            <Panel className="p-6">
                                <ReportMarkdownRenderer content={run.finalReport} />
                            </Panel>
                        ) : (
                            <Panel className="p-8 text-center">
                                <div className="text-sm text-text-muted">
                                    {run.status === "COMPLETED" ? "No report was generated for this run." : "Report will be available after all stages complete."}
                                </div>
                            </Panel>
                        )}
                    </div>
                )}
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

function StatusBadge({ status }: { status: AutomationStatus }) {
    const styles: Record<AutomationStatus, string> = {
        COMPLETED: "bg-status-success-bg text-status-success-text border-status-success-border",
        FAILED: "bg-status-error-bg text-status-error-text border-status-error-border",
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
