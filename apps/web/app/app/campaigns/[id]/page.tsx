"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuditChain, AuditRun } from "@numezis/shared/chainTypes";
import type { AgentEvent } from "@numezis/shared/types";
import { Button, Panel } from "@numezis/ui/components/design-system";
import { ChainBuilderModal } from "@numezis/ui/components/ChainBuilderModal";
import {
    Play,
    Pause,
    Edit2,
    History,
    FileJson,
    FileText,
    ArrowLeft,
    Settings,
    Activity,
    CheckCircle2,
    Terminal,
    Layers,
    ChevronRight,
    Clock,
    AlertCircle,
    PlayCircle,
    Search,
    RefreshCw,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { cn } from "@numezis/shared/utils/cn";

interface ChainDetailPageProps {
    params: { id: string };
}

type Tab = "overview" | "configuration" | "history";
const POLL_INTERVAL_MS = 4000;

type PromptIssue = {
    index: number;
    stageId: string;
    stageName: string;
};

function getPromptIssues(chain: AuditChain): PromptIssue[] {
    return chain.stages
        .map((stage, index) => {
            if (stage.prompt && stage.prompt.trim().length > 0) return null;
            return { index, stageId: stage.id, stageName: stage.name };
        })
        .filter(Boolean) as PromptIssue[];
}

export default function ChainDetailPage({ params }: ChainDetailPageProps) {
    const router = useRouter();
    const [chain, setChain] = useState<AuditChain | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [refreshError, setRefreshError] = useState("");
    const [executeError, setExecuteError] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    useEffect(() => {
        void fetchChain();
    }, [params.id]);

    useEffect(() => {
        if (!chain) return;
        if (chain.status === "RUNNING" || chain.status === "PAUSED") {
            const interval = setInterval(() => {
                void fetchChain({ background: true });
            }, POLL_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [chain?.status, params.id]);

    const fetchChain = async ({ background = false }: { background?: boolean } = {}) => {
        if (background) {
            setRefreshing(true);
            setRefreshError("");
        } else {
            setLoading(true);
            setError("");
            setExecuteError("");
        }
        try {
            const chainRes = await fetch(`/api/campaigns/${params.id}`);
            if (!chainRes.ok) throw new Error("Failed to load campaign");
            const chainData = await chainRes.json();
            setChain(chainData.chain);
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

    const handleOpenLatestRun = async () => {
        try {
            const res = await fetch(`/api/campaigns/${params.id}/runs`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load runs");
            const data = (await res.json()) as { runs: AuditRun[] };
            const runs = Array.isArray(data.runs) ? data.runs : [];
            if (!runs.length) {
                return;
            }
            const active = runs.find((run) =>
                run.status === "RUNNING" || run.status === "PAUSED" || run.status === "PENDING"
            );
            const target = active ?? runs[0];
            const runId = target?._id ? String(target._id) : "";
            if (runId) {
                router.push(`/app/runs/${runId}`);
                return;
            }
        } catch {
            // ignore
        }
        router.push(`/app/runs?campaignId=${encodeURIComponent(params.id)}`);
    };

    const handleExecute = async () => {
        try {
            setExecuteError("");
            const res = await fetch(`/api/campaigns/${params.id}/execute`, {
                method: "PUT",
            });
            const data = (await res.json().catch(() => ({}))) as { status?: string; runId?: string; error?: string; details?: any[] };
            if (!res.ok) {
                const detailText = Array.isArray(data.details)
                    ? data.details
                        .map((d: any) => (d?.stageName ? `${d.stageName} (stage ${d.index + 1})` : d?.stageId || String(d)))
                        .join(", ")
                    : "";
                const message = data.error || "Failed to start execution";
                throw new Error(detailText ? `${message} — ${detailText}` : message);
            }
            if (!data.runId) throw new Error("Execution started but no runId was returned");
            router.push(`/app/runs/${data.runId}`);
        } catch (err: any) {
            setExecuteError(err.message || "Failed to start campaign");
        }
    };

    const handlePause = async () => {
        try {
            const res = await fetch(`/api/campaigns/${params.id}/pause`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to pause");
            await fetchChain();
        } catch (err: any) {
            alert(`Failed to pause chain: ${err.message}`);
        }
    };

    const downloadFile = (filename: string, content: string, contentType: string) => {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportJSON = async () => {
        if (!chain) return;
        try {
            const res = await fetch(`/api/campaigns/${params.id}/report`);
            const data = await res.json();
            downloadFile(`chain-audit-${params.id}.json`, JSON.stringify(data, null, 2), "application/json");
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    const handleExportMarkdown = async () => {
        if (!chain) return;
        try {
            const res = await fetch(`/api/campaigns/${params.id}/report`);
            const data = await res.json();
            downloadFile(`chain-audit-${params.id}.md`, data.report || "# Audit Report", "text/markdown");
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-bg-surface">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
                    <span className="text-xs text-text-muted">Loading campaign...</span>
                </div>
            </div>
        );
    }

    if (error || !chain) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg-surface">
                <p className="text-sm text-rose-400">Error: {error || "Chain not found"}</p>
                <Button variant="secondary" onClick={() => router.push("/app/campaigns")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to List
                </Button>
            </div>
        );
    }

    const promptIssues = getPromptIssues(chain);
    const isBlocked = promptIssues.length > 0;
    const displayStatus = isBlocked ? "BLOCKED" : chain.status;
    const totalStages = chain.stages.length;
    const completedStages = chain.status === "COMPLETED"
        ? totalStages
        : Math.min(chain.currentStageIndex ?? 0, totalStages);
    const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
    const activeStageIndex = totalStages > 0 ? Math.min(chain.currentStageIndex ?? 0, totalStages - 1) : -1;
    const activeStage = (chain.status === "RUNNING" || chain.status === "PAUSED") && activeStageIndex >= 0
        ? chain.stages[activeStageIndex]
        : null;
    const blockedStageNames = promptIssues.map((issue) => issue.stageName).join(", ");

    return (
        <div className="flex flex-col h-full bg-bg-surface">
            <ChainBuilderModal
                open={isEditing}
                onClose={() => setIsEditing(false)}
                onCreated={() => {
                    setIsEditing(false);
                    void fetchChain();
                }}
                editChainId={params.id}
            />

            {/* High-Density Header (Header-less Workbench Style) */}
            <div className="flex flex-col border-b border-border-subtle bg-bg-surface px-6 pt-5 pb-0 gap-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h1 className="text-xl font-bold tracking-tight text-text-primary">{chain.name}</h1>
                        <p className="text-xs text-text-muted max-w-2xl">{chain.description || "No description provided."}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {refreshing && (
                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400/70" />
                                Updating
                            </div>
                        )}
                        {refreshError && !refreshing && (
                            <div className="text-[10px] text-rose-300">Live update failed</div>
                        )}
                        {isBlocked && (
                            <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} className="gap-2 border-amber-500/40 text-amber-200">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Fix Prompts
                            </Button>
                        )}
                        {/* Start / Resume Action */}
                        {!isBlocked && (chain.status === "PENDING" || chain.status === "PAUSED") && (
                            <Button size="sm" onClick={() => void handleExecute()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
                                <Play className="h-3.5 w-3.5" />
                                {chain.status === "PAUSED" ? "Resume Campaign" : "Start Campaign"}
                            </Button>
                        )}

                        {/* Pause Action */}
                        {chain.status === "RUNNING" && (
                            <Button size="sm" variant="secondary" onClick={() => void handlePause()} className="gap-2">
                                <Pause className="h-3.5 w-3.5 text-amber-500" /> Pause
                            </Button>
                        )}

                        {/* Rerun Action */}
                        {!isBlocked && (chain.status === "COMPLETED" || chain.status === "FAILED" || chain.status === "CANCELLED") && (
                            <Button size="sm" onClick={() => void handleExecute()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
                                <Play className="h-3.5 w-3.5" /> Rerun Analysis
                            </Button>
                        )}

                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} title="Edit Configuration">
                            <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 mt-2">
                    <TabButton
                        active={activeTab === "overview"}
                        onClick={() => setActiveTab("overview")}
                        icon={<Activity className="h-3.5 w-3.5" />}
                        label="Overview"
                    />
                    <TabButton
                        active={activeTab === "configuration"}
                        onClick={() => setActiveTab("configuration")}
                        icon={<Settings className="h-3.5 w-3.5" />}
                        label="Configuration"
                    />
                    <TabButton
                        active={activeTab === "history"}
                        onClick={() => setActiveTab("history")}
                        icon={<History className="h-3.5 w-3.5" />}
                        label="Runs & History"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 bg-bg-base/30">
                {activeTab === "overview" && (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            <StatCard label="Total Stages" value={chain.stages.length} />
                            <StatCard label="Current Status" value={displayStatus} status={displayStatus} />
                            <StatCard label="Last Run" value={chain.startedAt ? new Date(chain.startedAt).toLocaleString() : "-"} />
                            <StatCard label="Progress" value={`${completedStages}/${totalStages}`} />
                        </div>

                        {executeError && (
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                                {executeError}
                            </div>
                        )}

                        {isBlocked && (
                            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-4 w-4 text-amber-300 mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-amber-200">Campaign blocked</div>
                                        <div className="text-xs text-amber-200/80">
                                            Missing prompts for: {blockedStageNames || "Unnamed stages"}
                                        </div>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
                                        Edit prompts
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!isBlocked && totalStages > 0 && (
                            <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                                <div className="flex items-center justify-between text-xs text-text-muted">
                                    <span>Execution Progress</span>
                                    <span>{progressPercent}%</span>
                                </div>
                                <div className="mt-2 h-2 w-full rounded-full bg-bg-elevated">
                                    <div
                                        className="h-2 rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                {activeStage && (
                                    <div className="mt-2 text-xs text-text-secondary">
                                        {chain.status === "PAUSED" ? "Paused on" : "Running"}: {activeStage.name}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions Panel (for export) */}
                        {chain.status === "COMPLETED" && (
                            <div className="flex gap-2 p-4 rounded-lg border border-border-subtle bg-bg-surface items-center justify-between">
                                <span className="text-sm font-medium text-text-primary">Export Results</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => void handleExportJSON()} className="gap-2">
                                        <FileJson className="h-3.5 w-3.5" /> JSON
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => void handleExportMarkdown()} className="gap-2">
                                        <FileText className="h-3.5 w-3.5" /> Markdown
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Findings Summary */}
                        {chain.status === "COMPLETED" && (!chain.aggregatedFindings || chain.aggregatedFindings.length === 0) && (
                            <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 flex flex-col items-center text-center text-text-muted">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-50" />
                                <span className="text-sm font-medium text-text-primary">No findings detected</span>
                                <span className="text-xs">The audit completed successfully with no issues found.</span>
                            </div>
                        )}

                        {chain.aggregatedFindings && chain.aggregatedFindings.length > 0 && (
                            <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
                                <div className="px-4 py-3 border-b border-border-subtle bg-bg-elevated/20 flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-text-primary">Review Findings ({chain.aggregatedFindings.length})</h3>
                                    <Button size="sm" variant="secondary" onClick={() => router.push(`/app/history?type=campaign&campaignId=${params.id}`)} className="text-[10px] h-6">View All</Button>
                                </div>
                                <div className="divide-y divide-border-subtle">
                                    {chain.aggregatedFindings.slice(0, 5).map((finding, i) => (
                                        <div key={i} className="p-3 flex gap-3 text-sm hover:bg-bg-elevated/10 transition-colors">
                                            <div className={cn(
                                                "mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0",
                                                finding.type === "BLOQUANT" ? "bg-rose-500" :
                                                    finding.type === "WARNING" ? "bg-amber-500" : "bg-blue-400"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-text-primary font-medium truncate">{finding.description}</p>
                                                <p className="text-xs text-text-muted truncate font-mono mt-0.5">{finding.file}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stages Preview */}
                        <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-text-muted ml-1">Pipeline Stages</div>
                            {chain.stages.map((stage, idx) => {
                                const promptMissing = !stage.prompt || stage.prompt.trim() === "";
                                const failedStageIndex = Math.max(0, completedStages - 1);
                                const isCompleted = chain.status === "COMPLETED" || idx < completedStages;
                                const isCurrent = (chain.status === "RUNNING" || chain.status === "PAUSED") && idx === completedStages;

                                let stageStatus = "PENDING";
                                if (promptMissing) stageStatus = "BLOCKED";
                                else if (chain.status === "FAILED" && idx === failedStageIndex) stageStatus = "FAILED";
                                else if (chain.status === "CANCELLED" && idx === failedStageIndex) stageStatus = "CANCELLED";
                                else if (isCompleted) stageStatus = "COMPLETED";
                                else if (isCurrent) stageStatus = chain.status === "PAUSED" ? "PAUSED" : "RUNNING";

                                const statusStyles: Record<string, string> = {
                                    COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                    RUNNING: "bg-blue-500/10 text-blue-300 border-blue-500/20",
                                    PAUSED: "bg-amber-500/10 text-amber-300 border-amber-500/20",
                                    FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                                    CANCELLED: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
                                    BLOCKED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
                                    PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
                                };

                                const indicatorClass = stageStatus === "COMPLETED"
                                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                    : stageStatus === "RUNNING"
                                        ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                                        : stageStatus === "PAUSED"
                                            ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                            : stageStatus === "FAILED"
                                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                : stageStatus === "BLOCKED"
                                                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                                    : "bg-bg-elevated text-text-muted border-border-subtle";

                                return (
                                    <div key={stage.id} className="group flex items-center gap-4 p-3 rounded-md border border-border-subtle bg-bg-surface hover:border-border-strong transition-colors">
                                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono border transition-colors ${indicatorClass}`}>
                                            {stageStatus === "COMPLETED" ? "✓" : idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-text-primary truncate">{stage.name}</div>
                                        <div className="text-[11px] text-text-muted truncate font-mono mt-0.5">
                                            {stage.llmProvider}
                                        </div>
                                        <div className={`text-[11px] truncate font-mono mt-0.5 ${promptMissing ? "text-rose-300" : "text-text-muted"}`}>
                                            {promptMissing ? "Missing prompt" : stage.prompt}
                                        </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded border ${statusStyles[stageStatus] || statusStyles.PENDING}`}>
                                                {stageStatus}
                                            </span>
                                            <button
                                                type="button"
                                                className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded border border-border-subtle hover:text-text-primary hover:border-border-strong transition-colors"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleOpenLatestRun();
                                                }}
                                                title="Open current run"
                                            >
                                                {stage.graphId}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === "configuration" && (
                    <div className="max-w-4xl mx-auto">
                        <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
                            <div className="p-4 border-b border-border-subtle bg-bg-elevated/30 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-text-primary">Raw Configuration</h3>
                                <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>Edit Config</Button>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <pre className="text-[11px] font-mono text-text-secondary leading-relaxed">
                                    {JSON.stringify(chain, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="max-w-4xl mx-auto">
                        <ActivityList
                            campaignId={params.id}
                            campaignName={chain.name}
                            isRunning={chain.status === "RUNNING" || chain.status === "PAUSED"}
                            stages={chain.stages.map((stage) => ({ id: stage.id, name: stage.name }))}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    label,
    icon,
    external
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon?: React.ReactNode;
    external?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 pb-3 mb-[-1px] text-sm font-medium transition-colors border-b-2",
                active
                    ? "border-text-primary text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-secondary hover:border-border-strong"
            )}
        >
            {icon && <span className={cn("opacity-70", active && "opacity-100")}>{icon}</span>}
            {label}
            {external && <span className="ml-1 opacity-50 text-[10px]">↗</span>}
        </button>
    );
}

function StatCard({ label, value, status }: { label: string; value: string | number; status?: string }) {
    // Reduced font size from 2xl to lg/xl and used medium weight for cleaner look
    let valueClass = "text-xl font-medium tracking-tight text-text-primary";
    if (status === "RUNNING") valueClass = "text-xl font-medium tracking-tight text-blue-400";
    if (status === "COMPLETED") valueClass = "text-xl font-medium tracking-tight text-emerald-400";
    if (status === "FAILED") valueClass = "text-xl font-medium tracking-tight text-rose-400";
    if (status === "BLOCKED") valueClass = "text-xl font-medium tracking-tight text-amber-400";

    return (
        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{label}</span>
            <span className={valueClass}>{value}</span>
        </div>
    );
}

type ActivityItem = {
    id: string;
    type: "WORKBENCH" | "CAMPAIGN";
    title: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED" | "CANCELLED";
    startedAt: string;
    endedAt?: string;
    conclusion?: string;
    metadata?: {
        totalFindings?: number;
        totalClaims?: number;
        totalVerified?: number;
        totalDuration?: number;
    };
    link: string;
};

function ActivityList({
    campaignId,
    campaignName,
    isRunning,
    stages
}: {
    campaignId: string;
    campaignName?: string;
    isRunning?: boolean;
    stages?: { id: string; name: string }[];
}) {
    const router = useRouter();
    const [runs, setRuns] = useState<AuditRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
    const [logCache, setLogCache] = useState<Record<string, { events: AgentEvent[]; loading: boolean; error?: string }>>({});

    useEffect(() => {
        void fetchActivity();
    }, [campaignId, campaignName]);

    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(() => {
            void fetchActivity({ background: true });
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [campaignId, isRunning]);

    const fetchActivity = async ({ background = false }: { background?: boolean } = {}) => {
        if (background) {
            setRefreshing(true);
        } else {
            setLoading(true);
            setError("");
        }
        try {
            const url = `/api/campaigns/${campaignId}/runs`;
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load activity history");
            const data = (await res.json()) as { runs: AuditRun[] };
            const runs = Array.isArray(data.runs) ? data.runs : [];
            setRuns(runs);
        } catch (err: unknown) {
            if (!background) {
                setError(err instanceof Error ? err.message : "Unknown error");
            }
        } finally {
            if (background) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    };

    const mapRunToItem = (run: AuditRun): ActivityItem => {
        const titleBase = campaignName || "Campaign";
        const runId = run._id ? String(run._id) : "";
        const shortId = runId ? `${runId.slice(0, 6)}…${runId.slice(-3)}` : "run";
        const startedAt = run.startedAt ? new Date(run.startedAt).toISOString() : new Date().toISOString();
        const endedAt = run.endedAt ? new Date(run.endedAt).toISOString() : undefined;
        const totalFindings = run.aggregatedFindings?.length ?? 0;
        const totalDuration = run.metadata?.totalDuration ?? (endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : undefined);

        return {
            id: runId || shortId,
            type: "CAMPAIGN",
            title: `${titleBase} • ${shortId}`,
            status: run.status || "PENDING",
            startedAt,
            endedAt,
            conclusion: run.finalReport ? "Final report available" : undefined,
            metadata: {
                totalFindings,
                totalClaims: run.metadata?.totalClaims,
                totalVerified: run.metadata?.totalVerified,
                totalDuration,
            },
            link: runId ? `/app/runs/${runId}` : "/app/runs",
        };
    };

    const getPreviewSession = (run: AuditRun) => {
        const stageCount = stages?.length ?? 0;
        const safeStageCount = stageCount > 0 ? stageCount : run.sessionIds?.length ?? 0;
        if (!safeStageCount) return { sessionId: undefined, stageName: undefined, stageIndex: undefined };

        const currentIndexRaw = typeof run.currentStageIndex === "number" ? run.currentStageIndex : 0;
        const currentIndex = Math.min(Math.max(currentIndexRaw, 0), safeStageCount - 1);
        let candidateIndex = (run.sessionIds?.length ?? 0) > 0 ? (run.sessionIds?.length ?? 1) - 1 : undefined;
        if (run.status === "RUNNING" || run.status === "PAUSED" || run.status === "PENDING") {
            if (run.sessionIds?.[currentIndex]) {
                candidateIndex = currentIndex;
            }
        }
        if (candidateIndex === undefined) {
            return { sessionId: undefined, stageName: undefined, stageIndex: undefined };
        }

        const sessionId = run.sessionIds?.[candidateIndex];
        const stageName = stages?.[candidateIndex]?.name ?? `Stage ${candidateIndex + 1}`;
        return { sessionId, stageName, stageIndex: candidateIndex };
    };

    const fetchLogs = async (sessionId: string) => {
        setLogCache((prev) => ({
            ...prev,
            [sessionId]: { events: prev[sessionId]?.events ?? [], loading: true, error: undefined }
        }));
        try {
            const res = await fetch(`/api/audits/${sessionId}`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load stage logs");
            const data = await res.json();
            const stream = data.eventStream || data.workflowResult?.eventStream;
            const events = Array.isArray(stream) ? (stream as AgentEvent[]) : [];
            setLogCache((prev) => ({
                ...prev,
                [sessionId]: { events, loading: false }
            }));
        } catch (err: unknown) {
            setLogCache((prev) => ({
                ...prev,
                [sessionId]: {
                    events: prev[sessionId]?.events ?? [],
                    loading: false,
                    error: err instanceof Error ? err.message : "Unknown error"
                }
            }));
        }
    };

    const toggleRunLogs = (runId: string, sessionId?: string) => {
        setExpandedRuns((prev) => {
            const next = { ...prev, [runId]: !prev[runId] };
            return next;
        });
        if (sessionId && !logCache[sessionId]) {
            void fetchLogs(sessionId);
        }
    };

    const formatLogLine = (event: AgentEvent) => {
        const label = event.phaseLabel || event.phaseId || event.kind.toUpperCase();
        const content = event.content || event.toolOutput || event.toolArgs || "";
        const snippet = content.length > 160 ? `${content.slice(0, 160)}…` : content;
        const time = new Date(event.timestamp).toLocaleTimeString();
        return `${time} • ${label}: ${snippet}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
                Error: {error}
            </div>
        );
    }

    if (runs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-surface p-20 text-center">
                <Activity className="mb-4 h-10 w-10 text-text-muted opacity-20" />
                <p className="text-sm text-text-muted">
                    No activity history found for this campaign.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-text-muted">Runs</div>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                        event.stopPropagation();
                        void fetchActivity({ background: true });
                    }}
                    className="gap-2 text-[10px] h-7"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                    Refresh
                </Button>
            </div>
            {runs.map((run) => {
                const item = mapRunToItem(run);
                const runId = run._id ? String(run._id) : item.id;
                const preview = getPreviewSession(run);
                const previewSessionId = preview.sessionId;
                const cache = previewSessionId ? logCache[previewSessionId] : undefined;
                const isExpanded = !!expandedRuns[runId];
                const previewEvents = cache?.events ? cache.events.slice(-3) : [];

                return (
                    <Panel
                        key={`${item.type}-${item.id}`}
                        className="group relative cursor-pointer overflow-hidden p-0 transition hover:border-border-strong hover:bg-state-hover"
                        onClick={() => router.push(item.link)}
                    >
                        <div className="flex items-stretch text-left">
                            {/* Type indicator */}
                            <div className={`w-1 shrink-0 ${item.type === "WORKBENCH" ? "bg-zinc-400/40" : "bg-emerald-500/40"}`} />

                            <div className="flex flex-1 items-center gap-4 p-4 min-w-0">
                                {/* Column 1: Icon */}
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${item.type === "WORKBENCH"
                                    ? "bg-zinc-400/10 border-zinc-400/10 text-zinc-300"
                                    : "bg-emerald-500/10 border-emerald-500/10 text-emerald-400"
                                    }`}>
                                    {item.type === "WORKBENCH" ? <Terminal className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
                                </div>

                                {/* Column 2: Main Content */}
                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <h3
                                            className="truncate text-sm font-semibold text-text-primary"
                                            title={item.title}
                                        >
                                            {item.title}
                                        </h3>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Date Chip */}
                                        <span className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                                            <Clock className="h-3 w-3" />
                                            {new Date(item.startedAt).toLocaleString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </span>

                                        {/* Findings Chip */}
                                        {item.metadata?.totalFindings !== undefined && (
                                            <span className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">
                                                <Search className="h-3 w-3" />
                                                {item.metadata.totalFindings} findings
                                            </span>
                                        )}
                                    </div>

                                    {item.conclusion && (
                                        <p
                                            className="line-clamp-1 text-xs text-text-secondary"
                                            title={item.conclusion}
                                        >
                                            {item.conclusion}
                                        </p>
                                    )}
                                </div>

                                {/* Column 3: Status & Actions */}
                                <div className="flex shrink-0 flex-col items-end gap-2 pl-2">
                                    <StatusBadge status={item.status} />

                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            className="h-7 px-2 text-[10px] text-text-muted hover:text-text-primary border border-border-subtle rounded"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                if (previewSessionId) {
                                                    void fetchLogs(previewSessionId);
                                                }
                                            }}
                                            disabled={!previewSessionId}
                                            title={previewSessionId ? "Refresh logs" : "Logs not available yet"}
                                        >
                                            <RefreshCw className={cn("h-3 w-3", cache?.loading && "animate-spin")} />
                                        </button>
                                        <button
                                            className="h-7 px-2 text-[10px] text-text-muted hover:text-text-primary border border-border-subtle rounded flex items-center gap-1"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleRunLogs(runId, previewSessionId);
                                            }}
                                            disabled={!previewSessionId}
                                        >
                                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            Logs
                                        </button>
                                        <ChevronRight className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border-subtle bg-bg-elevated/10 px-4 py-2">
                            <div className="flex items-center justify-between text-[10px] text-text-muted">
                                <span>Latest stage: {preview.stageName || "Not started"}</span>
                                {!previewSessionId && <span>No logs yet</span>}
                            </div>

                            {isExpanded && previewSessionId && (
                                <div className="mt-2 space-y-2">
                                    {cache?.loading && (
                                        <div className="text-[10px] text-text-muted">Loading logs…</div>
                                    )}
                                    {cache?.error && (
                                        <div className="text-[10px] text-rose-300">Error: {cache.error}</div>
                                    )}
                                    {!cache?.loading && previewEvents.length === 0 && !cache?.error && (
                                        <div className="text-[10px] text-text-muted">No log events yet.</div>
                                    )}
                                    {previewEvents.map((event) => (
                                        <div key={event.id} className="text-[11px] text-text-secondary font-mono line-clamp-1">
                                            {formatLogLine(event)}
                                        </div>
                                    ))}
                                    {cache?.events && cache.events.length > 3 && (
                                        <div className="text-[10px] text-text-muted">
                                            Showing last 3 events
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Panel>
                );
            })}
        </div>
    );
}

function StatusBadge({ status }: { status: ActivityItem["status"] }) {
    const styles: Record<ActivityItem["status"], { bg: string; text: string; icon: any }> = {
        COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2 },
        FAILED: { bg: "bg-rose-500/10", text: "text-rose-400", icon: AlertCircle },
        RUNNING: { bg: "bg-zinc-400/10", text: "text-zinc-300", icon: PlayCircle },
        PENDING: { bg: "bg-bg-elevated", text: "text-text-muted", icon: Clock },
        PAUSED: { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Clock },
        CANCELLED: { bg: "bg-zinc-500/10", text: "text-zinc-300", icon: AlertCircle },
    };

    const config = styles[status] || styles.PENDING;
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.bg} ${config.text}`}>
            {status === "RUNNING" ? (
                <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                </span>
            ) : (
                <Icon className="h-3 w-3" />
            )}
            {status}
        </span>
    );
}
