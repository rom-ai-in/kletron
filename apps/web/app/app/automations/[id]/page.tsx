"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AutomationDefinition, AutomationRun, AutomationTriggerType } from "@numezis/shared/automationTypes";
import type { AgentEvent } from "@numezis/shared/types";
import { Button, Panel } from "@numezis/ui/components/design-system";
import { AutomationBuilderModal } from "@numezis/ui/components/AutomationBuilderModal";
import { describeCron } from "@numezis/shared/cronUtils";
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
    ChevronUp,
    Webhook,
    GitBranch,
    Timer,
    Hand,
    Copy,
    Eye,
    EyeOff,
} from "lucide-react";
import { cn } from "@numezis/shared/utils/cn";

interface AutomationDetailPageProps {
    params: { id: string };
}

type Tab = "overview" | "trigger" | "configuration" | "history";
const POLL_INTERVAL_MS = 4000;

type PromptIssue = {
    index: number;
    stageId: string;
    stageName: string;
};

function getPromptIssues(automation: AutomationDefinition): PromptIssue[] {
    return automation.stages
        .map((stage, index) => {
            if (stage.prompt && stage.prompt.trim().length > 0) return null;
            return { index, stageId: stage.id, stageName: stage.name };
        })
        .filter(Boolean) as PromptIssue[];
}

export default function AutomationDetailPage({ params }: AutomationDetailPageProps) {
    const router = useRouter();
    const [automation, setAutomation] = useState<AutomationDefinition | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [refreshError, setRefreshError] = useState("");
    const [executeError, setExecuteError] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);

    useEffect(() => {
        void fetchAutomation();
    }, [params.id]);

    useEffect(() => {
        if (!automation) return;
        if (automation.status === "RUNNING" || automation.status === "PAUSED") {
            const interval = setInterval(() => {
                void fetchAutomation({ background: true });
            }, POLL_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [automation?.status, params.id]);

    const fetchAutomation = async ({ background = false }: { background?: boolean } = {}) => {
        if (background) {
            setRefreshing(true);
            setRefreshError("");
        } else {
            setLoading(true);
            setError("");
            setExecuteError("");
        }
        try {
            const res = await fetch(`/api/automations/${params.id}`);
            if (!res.ok) throw new Error("Failed to load automation");
            const data = await res.json();
            setAutomation(data.automation);
            if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
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
            const res = await fetch(`/api/automations/${params.id}/runs`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load runs");
            const data = (await res.json()) as { runs: AutomationRun[] };
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
        router.push(`/app/runs?automationId=${encodeURIComponent(params.id)}`);
    };

    const handleExecute = async () => {
        try {
            setExecuteError("");
            const res = await fetch(`/api/automations/${params.id}/execute`, {
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
            setExecuteError(err.message || "Failed to start automation");
        }
    };

    const handlePause = async () => {
        try {
            const res = await fetch(`/api/automations/${params.id}/pause`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to pause");
            await fetchAutomation();
        } catch (err: any) {
            alert(`Failed to pause automation: ${err.message}`);
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
        if (!automation) return;
        try {
            const res = await fetch(`/api/automations/${params.id}/report`);
            const data = await res.json();
            downloadFile(`automation-report-${params.id}.json`, JSON.stringify(data, null, 2), "application/json");
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    const handleExportMarkdown = async () => {
        if (!automation) return;
        try {
            const res = await fetch(`/api/automations/${params.id}/report`);
            const data = await res.json();
            downloadFile(`automation-report-${params.id}.md`, data.report || "# Audit Report", "text/markdown");
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-bg-surface">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
                    <span className="text-xs text-text-muted">Loading automation...</span>
                </div>
            </div>
        );
    }

    if (error || !automation) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg-surface">
                <p className="text-sm text-status-error-text">Error: {error || "Automation not found"}</p>
                <Button variant="secondary" onClick={() => router.push("/app/automations")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to List
                </Button>
            </div>
        );
    }

    const promptIssues = getPromptIssues(automation);
    const isBlocked = promptIssues.length > 0;
    const displayStatus = isBlocked ? "BLOCKED" : automation.status;
    const totalStages = automation.stages.length;
    const completedStages = automation.status === "COMPLETED"
        ? totalStages
        : Math.min(automation.currentStageIndex ?? 0, totalStages);
    const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
    const activeStageIndex = totalStages > 0 ? Math.min(automation.currentStageIndex ?? 0, totalStages - 1) : -1;
    const activeStage = (automation.status === "RUNNING" || automation.status === "PAUSED") && activeStageIndex >= 0
        ? automation.stages[activeStageIndex]
        : null;
    const blockedStageNames = promptIssues.map((issue) => issue.stageName).join(", ");

    return (
        <div className="flex flex-col h-full bg-bg-surface">
            <AutomationBuilderModal
                open={isEditing}
                onClose={() => setIsEditing(false)}
                onCreated={() => {
                    setIsEditing(false);
                    void fetchAutomation();
                }}
                editAutomationId={params.id}
            />

            {/* High-Density Header (Header-less Workbench Style) */}
            <div className="flex flex-col border-b border-border-subtle bg-bg-surface px-6 pt-5 pb-0 gap-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h1 className="text-xl font-bold tracking-tight text-text-primary">{automation.name}</h1>
                        <p className="text-xs text-text-muted max-w-2xl">{automation.description || "No description provided."}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {refreshing && (
                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-status-success" />
                                Updating
                            </div>
                        )}
                        {refreshError && !refreshing && (
                            <div className="text-[10px] text-status-error-text">Live update failed</div>
                        )}
                        {isBlocked && (
                            <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} className="gap-2 border-status-warning-border text-status-warning-text">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Fix Prompts
                            </Button>
                        )}
                        {/* Start / Resume Action */}
                        {!isBlocked && (automation.status === "PENDING" || automation.status === "PAUSED") && (
                            <Button size="sm" onClick={() => void handleExecute()} className="gap-2 bg-status-success hover:bg-status-success text-white border-transparent">
                                <Play className="h-3.5 w-3.5" />
                                {automation.status === "PAUSED" ? "Resume Automation" : "Start Automation"}
                            </Button>
                        )}

                        {/* Pause Action */}
                        {automation.status === "RUNNING" && (
                            <Button size="sm" variant="secondary" onClick={() => void handlePause()} className="gap-2">
                                <Pause className="h-3.5 w-3.5 text-status-warning-text" /> Pause
                            </Button>
                        )}

                        {/* Rerun Action */}
                        {!isBlocked && (automation.status === "COMPLETED" || automation.status === "FAILED" || automation.status === "CANCELLED") && (
                            <Button size="sm" onClick={() => void handleExecute()} className="gap-2 bg-status-success hover:bg-status-success text-white border-transparent">
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
                        active={activeTab === "trigger"}
                        onClick={() => setActiveTab("trigger")}
                        icon={<Timer className="h-3.5 w-3.5" />}
                        label="Trigger"
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
                            <StatCard label="Total Stages" value={automation.stages.length} />
                            <StatCard label="Current Status" value={displayStatus} status={displayStatus} />
                            <StatCard label="Trigger" value={triggerTypeLabel(automation.triggerType)} />
                            <StatCard label="Progress" value={`${completedStages}/${totalStages}`} />
                        </div>

                        {/* Trigger Configuration Panel */}
                        {automation.triggerType && automation.triggerType !== "manual" && (
                            <TriggerInfoPanel
                                automation={automation}
                                webhookUrl={webhookUrl}
                                showSecret={showSecret}
                                onToggleSecret={() => setShowSecret(!showSecret)}
                            />
                        )}

                        {executeError && (
                            <div className="rounded-lg border border-status-error-border bg-status-error-bg p-3 text-xs text-status-error-text">
                                {executeError}
                            </div>
                        )}

                        {isBlocked && (
                            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-4 w-4 text-status-warning-text mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-status-warning-text">Automation blocked</div>
                                        <div className="text-xs text-status-warning-text">
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
                                        className="h-2 rounded-full bg-status-success transition-all"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                {activeStage && (
                                    <div className="mt-2 text-xs text-text-secondary">
                                        {automation.status === "PAUSED" ? "Paused on" : "Running"}: {activeStage.name}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions Panel (for export) */}
                        {automation.status === "COMPLETED" && (
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
                        {automation.status === "COMPLETED" && (!automation.aggregatedFindings || automation.aggregatedFindings.length === 0) && (
                            <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 flex flex-col items-center text-center text-text-muted">
                                <CheckCircle2 className="h-8 w-8 text-status-success-text mb-2 opacity-50" />
                                <span className="text-sm font-medium text-text-primary">No findings detected</span>
                                <span className="text-xs">The audit completed successfully with no issues found.</span>
                            </div>
                        )}

                        {automation.aggregatedFindings && automation.aggregatedFindings.length > 0 && (
                            <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
                                <div className="px-4 py-3 border-b border-border-subtle bg-bg-elevated/20 flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-text-primary">Review Findings ({automation.aggregatedFindings.length})</h3>
                                    <Button size="sm" variant="secondary" onClick={() => router.push(`/app/history?type=automation&automationId=${params.id}`)} className="text-[10px] h-6">View All</Button>
                                </div>
                                <div className="divide-y divide-border-subtle">
                                    {automation.aggregatedFindings.slice(0, 5).map((finding, i) => (
                                        <div key={i} className="p-3 flex gap-3 text-sm hover:bg-bg-elevated/10 transition-colors">
                                            <div className={cn(
                                                "mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0",
                                                finding.type === "BLOQUANT" ? "bg-status-error" :
                                                    finding.type === "WARNING" ? "bg-status-warning" : "bg-status-info"
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
                            {automation.stages.map((stage, idx) => {
                                const promptMissing = !stage.prompt || stage.prompt.trim() === "";
                                const failedStageIndex = Math.max(0, completedStages - 1);
                                const isCompleted = automation.status === "COMPLETED" || idx < completedStages;
                                const isCurrent = (automation.status === "RUNNING" || automation.status === "PAUSED") && idx === completedStages;

                                let stageStatus = "PENDING";
                                if (promptMissing) stageStatus = "BLOCKED";
                                else if (automation.status === "FAILED" && idx === failedStageIndex) stageStatus = "FAILED";
                                else if (automation.status === "CANCELLED" && idx === failedStageIndex) stageStatus = "CANCELLED";
                                else if (isCompleted) stageStatus = "COMPLETED";
                                else if (isCurrent) stageStatus = automation.status === "PAUSED" ? "PAUSED" : "RUNNING";

                                const statusStyles: Record<string, string> = {
                                    COMPLETED: "bg-status-success-bg text-status-success-text border-status-success-border",
                                    RUNNING: "bg-status-info-bg text-status-info-text border-status-info-border",
                                    PAUSED: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
                                    FAILED: "bg-status-error-bg text-status-error-text border-status-error-border",
                                    CANCELLED: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
                                    BLOCKED: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
                                    PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
                                };

                                const indicatorClass = stageStatus === "COMPLETED"
                                    ? "bg-status-success-bg text-status-success-text border-status-success-border"
                                    : stageStatus === "RUNNING"
                                        ? "bg-status-info-bg text-status-info-text border-status-info-border"
                                        : stageStatus === "PAUSED"
                                            ? "bg-status-warning-bg text-status-warning-text border-status-warning-border"
                                            : stageStatus === "FAILED"
                                                ? "bg-status-error-bg text-status-error-text border-status-error-border"
                                                : stageStatus === "BLOCKED"
                                                    ? "bg-status-warning-bg text-status-warning-text border-status-warning-border"
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
                                        <div className={`text-[11px] truncate font-mono mt-0.5 ${promptMissing ? "text-status-error-text" : "text-text-muted"}`}>
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

                {activeTab === "trigger" && (
                    <TriggerTab
                        automation={automation}
                        webhookUrl={webhookUrl}
                        onUpdate={() => void fetchAutomation()}
                    />
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
                                    {JSON.stringify(automation, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="max-w-4xl mx-auto">
                        <ActivityList
                            automationId={params.id}
                            automationName={automation.name}
                            isRunning={automation.status === "RUNNING" || automation.status === "PAUSED"}
                            stages={automation.stages.map((stage) => ({ id: stage.id, name: stage.name }))}
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
    if (status === "RUNNING") valueClass = "text-xl font-medium tracking-tight text-status-info-text";
    if (status === "COMPLETED") valueClass = "text-xl font-medium tracking-tight text-status-success-text";
    if (status === "FAILED") valueClass = "text-xl font-medium tracking-tight text-status-error-text";
    if (status === "BLOCKED") valueClass = "text-xl font-medium tracking-tight text-status-warning-text";

    return (
        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{label}</span>
            <span className={valueClass}>{value}</span>
        </div>
    );
}

type ActivityItem = {
    id: string;
    type: "WORKBENCH" | "AUTOMATION";
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
    automationId,
    automationName,
    isRunning,
    stages
}: {
    automationId: string;
    automationName?: string;
    isRunning?: boolean;
    stages?: { id: string; name: string }[];
}) {
    const router = useRouter();
    const [runs, setRuns] = useState<AutomationRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
    const [logCache, setLogCache] = useState<Record<string, { events: AgentEvent[]; loading: boolean; error?: string }>>({});

    useEffect(() => {
        void fetchActivity();
    }, [automationId, automationName]);

    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(() => {
            void fetchActivity({ background: true });
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [automationId, isRunning]);

    const fetchActivity = async ({ background = false }: { background?: boolean } = {}) => {
        if (background) {
            setRefreshing(true);
        } else {
            setLoading(true);
            setError("");
        }
        try {
            const url = `/api/automations/${automationId}/runs`;
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load activity history");
            const data = (await res.json()) as { runs: AutomationRun[] };
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

    const mapRunToItem = (run: AutomationRun): ActivityItem => {
        const titleBase = automationName || "Automation";
        const runId = run._id ? String(run._id) : "";
        const shortId = runId ? `${runId.slice(0, 6)}…${runId.slice(-3)}` : "run";
        const startedAt = run.startedAt ? new Date(run.startedAt).toISOString() : new Date().toISOString();
        const endedAt = run.endedAt ? new Date(run.endedAt).toISOString() : undefined;
        const totalFindings = run.aggregatedFindings?.length ?? 0;
        const totalDuration = run.metadata?.totalDuration ?? (endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : undefined);

        return {
            id: runId || shortId,
            type: "AUTOMATION",
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

    const getPreviewSession = (run: AutomationRun) => {
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
            <div className="rounded-lg border border-status-error-border bg-status-error-bg p-4 text-center text-sm text-status-error-text">
                Error: {error}
            </div>
        );
    }

    if (runs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-surface p-20 text-center">
                <Activity className="mb-4 h-10 w-10 text-text-muted opacity-20" />
                <p className="text-sm text-text-muted">
                    No activity history found for this automation.
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
                            <div className={`w-1 shrink-0 ${item.type === "WORKBENCH" ? "bg-zinc-400/40" : "bg-status-success-bg"}`} />

                            <div className="flex flex-1 items-center gap-4 p-4 min-w-0">
                                {/* Column 1: Icon */}
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${item.type === "WORKBENCH"
                                    ? "bg-zinc-400/10 border-zinc-400/10 text-zinc-300"
                                    : "bg-status-success-bg border-status-success-border text-status-success-text"
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
                                        <div className="text-[10px] text-status-error-text">Error: {cache.error}</div>
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
        COMPLETED: { bg: "bg-status-success-bg", text: "text-status-success-text", icon: CheckCircle2 },
        FAILED: { bg: "bg-status-error-bg", text: "text-status-error-text", icon: AlertCircle },
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

// ─── Trigger tab constants ──────────────────────────────────────────────────

const TRIGGER_OPTIONS: { id: AutomationTriggerType; label: string; description: string }[] = [
    { id: "manual", label: "Manual", description: "Triggered manually from the UI" },
    { id: "schedule", label: "Schedule", description: "Runs on a cron schedule" },
    { id: "webhook", label: "Webhook", description: "Triggered by an HTTP POST" },
    { id: "git_event", label: "Git Event", description: "Triggered by git push, PR, or tag" },
];

const CRON_PRESETS: { label: string; value: string }[] = [
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
    { label: "Daily at 2 AM", value: "0 2 * * *" },
    { label: "Daily at 9 AM", value: "0 9 * * *" },
    { label: "Weekly Mon 9 AM", value: "0 9 * * 1" },
    { label: "Custom", value: "" },
];

const COMMON_TIMEZONES = [
    "UTC", "Europe/London", "Europe/Paris", "Europe/Zurich", "Europe/Berlin",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
];

const GIT_EVENT_OPTIONS: { id: "push" | "pull_request" | "tag"; label: string }[] = [
    { id: "push", label: "Push" },
    { id: "pull_request", label: "Pull Request" },
    { id: "tag", label: "Tag" },
];

// ─── TriggerTab ─────────────────────────────────────────────────────────────

function TriggerTab({
    automation,
    webhookUrl,
    onUpdate,
}: {
    automation: AutomationDefinition;
    webhookUrl: string | null;
    onUpdate: () => void;
}) {
    const currentTrigger: AutomationTriggerType = automation.triggerType || "manual";
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    // Local editing state, seeded from automation
    const [triggerType, setTriggerType] = useState<AutomationTriggerType>(currentTrigger);
    const [cronExpr, setCronExpr] = useState(automation.schedule?.cron || "0 9 * * *");
    const [timezone, setTimezone] = useState(automation.schedule?.timezone || "UTC");
    const [maxRuns, setMaxRuns] = useState<number | undefined>(automation.schedule?.maxRuns);
    const [gitEvents, setGitEvents] = useState<("push" | "pull_request" | "tag")[]>(automation.gitEventConfig?.events || ["push"]);
    const [gitBranches, setGitBranches] = useState(automation.gitEventConfig?.branches?.join(", ") || "");
    const [allowedIps, setAllowedIps] = useState(automation.webhookConfig?.allowedIps?.join(", ") || "");

    // Sync when automation changes from server
    useEffect(() => {
        setTriggerType(automation.triggerType || "manual");
        setCronExpr(automation.schedule?.cron || "0 9 * * *");
        setTimezone(automation.schedule?.timezone || "UTC");
        setMaxRuns(automation.schedule?.maxRuns);
        setGitEvents(automation.gitEventConfig?.events || ["push"]);
        setGitBranches(automation.gitEventConfig?.branches?.join(", ") || "");
        setAllowedIps(automation.webhookConfig?.allowedIps?.join(", ") || "");
    }, [automation]);

    const hasChanges =
        triggerType !== currentTrigger ||
        (triggerType === "schedule" && (cronExpr !== (automation.schedule?.cron || "") || timezone !== (automation.schedule?.timezone || "UTC") || maxRuns !== automation.schedule?.maxRuns)) ||
        (triggerType === "git_event" && (JSON.stringify(gitEvents) !== JSON.stringify(automation.gitEventConfig?.events || []) || gitBranches !== (automation.gitEventConfig?.branches?.join(", ") || ""))) ||
        (triggerType === "webhook" && allowedIps !== (automation.webhookConfig?.allowedIps?.join(", ") || ""));

    const handleSave = async () => {
        setSaving(true);
        setSaveError("");
        setSaveSuccess(false);

        const config: any = {
            name: automation.name,
            description: automation.description,
            stages: automation.stages,
            triggerType,
        };

        if (triggerType === "schedule") {
            config.schedule = {
                enabled: true,
                cron: cronExpr,
                timezone,
                maxRuns: maxRuns || undefined,
            };
        }

        if (triggerType === "webhook") {
            const ips = allowedIps.split(",").map((ip: string) => ip.trim()).filter(Boolean);
            config.webhookConfig = {
                secret: automation.webhookConfig?.secret || undefined,
                allowedIps: ips.length > 0 ? ips : undefined,
            };
        }

        if (triggerType === "git_event") {
            const branches = gitBranches.split(",").map((b: string) => b.trim()).filter(Boolean);
            config.gitEventConfig = {
                events: gitEvents,
                branches: branches.length > 0 ? branches : undefined,
                secret: automation.gitEventConfig?.secret || undefined,
            };
        }

        try {
            const res = await fetch(`/api/automations/${automation._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update trigger");
            }
            setSaveSuccess(true);
            onUpdate();
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            setSaveError(err.message || "Unknown error");
        } finally {
            setSaving(false);
        }
    };

    const isPresetCron = CRON_PRESETS.some((p) => p.value === cronExpr && p.value !== "");

    const copyToClipboard = (text: string) => {
        void navigator.clipboard.writeText(text);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Trigger Type Selector */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">Trigger Type</h3>
                <div className="grid grid-cols-2 gap-3">
                    {TRIGGER_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTriggerType(opt.id)}
                            className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-all ${
                                triggerType === opt.id
                                    ? "border-text-primary bg-state-selected shadow-sm"
                                    : "border-border-subtle hover:border-border-strong hover:bg-state-hover"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                {opt.id === "manual" && <Hand className="h-4 w-4 text-text-muted" />}
                                {opt.id === "schedule" && <Timer className="h-4 w-4 text-status-info-text" />}
                                {opt.id === "webhook" && <Webhook className="h-4 w-4 text-status-warning-text" />}
                                {opt.id === "git_event" && <GitBranch className="h-4 w-4 text-status-success-text" />}
                                <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                            </div>
                            <span className="text-xs text-text-muted">{opt.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Schedule Configuration */}
            {triggerType === "schedule" && (
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary">Schedule Configuration</h4>

                    <div className="space-y-2">
                        <label className="text-xs text-text-muted uppercase font-medium">Frequency</label>
                        <div className="flex flex-wrap gap-2">
                            {CRON_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => {
                                        if (preset.value) setCronExpr(preset.value);
                                    }}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                                        (preset.value !== "" && cronExpr === preset.value) || (preset.value === "" && !isPresetCron && cronExpr !== "")
                                            ? "border-text-primary bg-state-selected text-text-primary"
                                            : "border-border-subtle text-text-muted hover:border-border-strong"
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-1">
                            <input
                                value={cronExpr}
                                onChange={(e) => setCronExpr(e.target.value)}
                                placeholder="Cron expression (e.g. 0 9 * * 1-5)"
                                className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                            />
                            {cronExpr && (
                                <div className="text-xs text-text-muted">{describeCron(cronExpr)}</div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-text-muted uppercase font-medium">Timezone</label>
                            <select
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                            >
                                {COMMON_TIMEZONES.map((tz) => (
                                    <option key={tz} value={tz}>{tz}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-text-muted uppercase font-medium">Max Runs (optional)</label>
                            <input
                                type="number"
                                min={1}
                                value={maxRuns || ""}
                                onChange={(e) => setMaxRuns(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                placeholder="Unlimited"
                                className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Show schedule stats if already running */}
                    {automation.triggerType === "schedule" && automation.schedule && (
                        <div className="rounded-lg border border-border-subtle bg-bg-elevated/30 p-3 grid grid-cols-3 gap-4 text-xs">
                            <div>
                                <span className="text-text-muted block">Executions</span>
                                <span className="text-text-primary font-medium">{automation.schedule.executionCount ?? 0}{automation.schedule.maxRuns ? ` / ${automation.schedule.maxRuns}` : ""}</span>
                            </div>
                            <div>
                                <span className="text-text-muted block">Next Run</span>
                                <span className="text-text-primary font-medium">
                                    {automation.schedule.nextScheduledAt ? new Date(automation.schedule.nextScheduledAt).toLocaleString() : "—"}
                                </span>
                            </div>
                            <div>
                                <span className="text-text-muted block">Last Triggered</span>
                                <span className="text-text-primary font-medium">
                                    {automation.schedule.lastScheduledAt ? new Date(automation.schedule.lastScheduledAt).toLocaleString() : "Never"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Webhook Configuration */}
            {triggerType === "webhook" && (
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary">Webhook Configuration</h4>

                    {/* Show URL and secret if already configured */}
                    {automation.triggerType === "webhook" && webhookUrl && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-text-muted uppercase font-medium">Webhook URL</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <code className="flex-1 rounded-lg bg-bg-elevated border border-border-subtle px-3 py-2 text-xs font-mono text-text-secondary truncate">
                                        {webhookUrl}
                                    </code>
                                    <button onClick={() => copyToClipboard(webhookUrl)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title="Copy URL">
                                        <Copy className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                            {automation.webhookConfig?.secret && (
                                <div>
                                    <label className="text-xs text-text-muted uppercase font-medium">Signing Secret</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <code className="flex-1 rounded-lg bg-bg-elevated border border-border-subtle px-3 py-2 text-xs font-mono text-text-secondary truncate">
                                            {showSecret ? automation.webhookConfig.secret : "••••••••••••••••••••••••••••••••"}
                                        </code>
                                        <button onClick={() => setShowSecret(!showSecret)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title={showSecret ? "Hide" : "Reveal"}>
                                            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                        <button onClick={() => copyToClipboard(automation.webhookConfig!.secret)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title="Copy secret">
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {automation.triggerType !== "webhook" && (
                        <div className="rounded-lg bg-bg-elevated/50 border border-border-subtle p-3 text-xs text-text-muted">
                            Save to generate a signing secret and webhook URL. You can then use the URL to trigger this automation from external services.
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs text-text-muted uppercase font-medium">Allowed IPs (optional, comma-separated)</label>
                        <input
                            value={allowedIps}
                            onChange={(e) => setAllowedIps(e.target.value)}
                            placeholder="Leave empty to allow any IP"
                            className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>

                    <div className="text-xs text-text-muted p-3 rounded-lg bg-bg-elevated/50 border border-border-subtle">
                        <strong>Usage:</strong> Send a POST request to the webhook URL with any JSON body.
                        Sign the raw body with HMAC-SHA256 using the secret, and include the hex digest in the <code className="bg-bg-elevated px-1 rounded">x-webhook-signature</code> header.
                    </div>
                </div>
            )}

            {/* Git Event Configuration */}
            {triggerType === "git_event" && (
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary">Git Event Configuration</h4>

                    <div className="space-y-2">
                        <label className="text-xs text-text-muted uppercase font-medium">Event Types</label>
                        <div className="flex gap-2">
                            {GIT_EVENT_OPTIONS.map((evt) => {
                                const selected = gitEvents.includes(evt.id);
                                return (
                                    <button
                                        key={evt.id}
                                        type="button"
                                        onClick={() => {
                                            setGitEvents(selected
                                                ? gitEvents.filter((e) => e !== evt.id)
                                                : [...gitEvents, evt.id]);
                                        }}
                                        className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                                            selected
                                                ? "border-text-primary bg-state-selected text-text-primary"
                                                : "border-border-subtle text-text-muted hover:border-border-strong"
                                        }`}
                                    >
                                        {evt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-text-muted uppercase font-medium">Branch Filter (optional, comma-separated)</label>
                        <input
                            value={gitBranches}
                            onChange={(e) => setGitBranches(e.target.value)}
                            placeholder="e.g. main, release/* (empty = all branches)"
                            className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>

                    {/* Show URL and secret if already configured */}
                    {automation.triggerType === "git_event" && webhookUrl && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-text-muted uppercase font-medium">Git Webhook URL</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <code className="flex-1 rounded-lg bg-bg-elevated border border-border-subtle px-3 py-2 text-xs font-mono text-text-secondary truncate">
                                        {webhookUrl}
                                    </code>
                                    <button onClick={() => copyToClipboard(webhookUrl)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title="Copy URL">
                                        <Copy className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                            {automation.gitEventConfig?.secret && (
                                <div>
                                    <label className="text-xs text-text-muted uppercase font-medium">Signing Secret</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <code className="flex-1 rounded-lg bg-bg-elevated border border-border-subtle px-3 py-2 text-xs font-mono text-text-secondary truncate">
                                            {showSecret ? automation.gitEventConfig.secret : "••••••••••••••••••••••••••••••••"}
                                        </code>
                                        <button onClick={() => setShowSecret(!showSecret)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title={showSecret ? "Hide" : "Reveal"}>
                                            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                        <button onClick={() => copyToClipboard(automation.gitEventConfig!.secret)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title="Copy secret">
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {automation.triggerType !== "git_event" && (
                        <div className="rounded-lg bg-bg-elevated/50 border border-border-subtle p-3 text-xs text-text-muted">
                            Save to generate a signing secret. Then configure the webhook URL in your GitHub or GitLab repository settings.
                        </div>
                    )}
                </div>
            )}

            {/* Manual info */}
            {triggerType === "manual" && (
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
                    <div className="flex items-center gap-3 text-text-muted">
                        <Hand className="h-5 w-5" />
                        <div>
                            <div className="text-sm font-medium text-text-primary">Manual Trigger</div>
                            <div className="text-xs text-text-muted mt-0.5">This automation runs only when you click the "Start Automation" button above.</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Save bar */}
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface p-4">
                <div className="text-xs">
                    {saveError && <span className="text-status-error-text">{saveError}</span>}
                    {saveSuccess && <span className="text-status-success-text">Trigger configuration saved successfully.</span>}
                    {!saveError && !saveSuccess && hasChanges && <span className="text-text-muted">You have unsaved changes.</span>}
                    {!saveError && !saveSuccess && !hasChanges && <span className="text-text-muted">No changes.</span>}
                </div>
                <Button
                    size="sm"
                    disabled={!hasChanges || saving}
                    loading={saving}
                    onClick={() => void handleSave()}
                >
                    Save Trigger Config
                </Button>
            </div>
        </div>
    );
}

function triggerTypeLabel(triggerType?: AutomationTriggerType): string {
    switch (triggerType) {
        case "schedule": return "Scheduled";
        case "webhook": return "Webhook";
        case "git_event": return "Git Event";
        default: return "Manual";
    }
}

function TriggerInfoPanel({
    automation,
    webhookUrl,
    showSecret,
    onToggleSecret,
}: {
    automation: AutomationDefinition;
    webhookUrl: string | null;
    showSecret: boolean;
    onToggleSecret: () => void;
}) {
    const copyToClipboard = (text: string) => {
        void navigator.clipboard.writeText(text);
    };

    const TriggerIcon = automation.triggerType === "schedule"
        ? Timer
        : automation.triggerType === "webhook"
        ? Webhook
        : automation.triggerType === "git_event"
        ? GitBranch
        : Hand;

    return (
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
            <div className="flex items-center gap-2 mb-3">
                <TriggerIcon className="h-4 w-4 text-text-muted" />
                <h3 className="text-sm font-semibold text-text-primary">
                    {triggerTypeLabel(automation.triggerType)} Trigger
                </h3>
            </div>

            {/* Schedule info */}
            {automation.triggerType === "schedule" && automation.schedule && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div>
                        <span className="text-text-muted">Schedule</span>
                        <div className="text-text-primary font-medium">{describeCron(automation.schedule.cron)}</div>
                    </div>
                    <div>
                        <span className="text-text-muted">Timezone</span>
                        <div className="text-text-primary font-medium">{automation.schedule.timezone}</div>
                    </div>
                    <div>
                        <span className="text-text-muted">Next Run</span>
                        <div className="text-text-primary font-medium">
                            {automation.schedule.nextScheduledAt
                                ? new Date(automation.schedule.nextScheduledAt).toLocaleString()
                                : automation.schedule.enabled ? "Computing..." : "Disabled"}
                        </div>
                    </div>
                    <div>
                        <span className="text-text-muted">Executions</span>
                        <div className="text-text-primary font-medium">
                            {automation.schedule.executionCount ?? 0}
                            {automation.schedule.maxRuns ? ` / ${automation.schedule.maxRuns}` : ""}
                        </div>
                    </div>
                    {automation.schedule.lastScheduledAt && (
                        <div>
                            <span className="text-text-muted">Last Triggered</span>
                            <div className="text-text-primary font-medium">
                                {new Date(automation.schedule.lastScheduledAt).toLocaleString()}
                            </div>
                        </div>
                    )}
                    <div>
                        <span className="text-text-muted">Cron Expression</span>
                        <div className="text-text-primary font-mono">{automation.schedule.cron}</div>
                    </div>
                </div>
            )}

            {/* Webhook info */}
            {automation.triggerType === "webhook" && (
                <div className="space-y-3 text-xs">
                    {webhookUrl && (
                        <div>
                            <span className="text-text-muted">Webhook URL</span>
                            <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 rounded bg-bg-elevated px-2 py-1 text-[11px] font-mono text-text-secondary truncate">
                                    {webhookUrl}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(webhookUrl)}
                                    className="rounded p-1 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors"
                                    title="Copy URL"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                    {automation.webhookConfig?.secret && (
                        <div>
                            <span className="text-text-muted">Signing Secret</span>
                            <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 rounded bg-bg-elevated px-2 py-1 text-[11px] font-mono text-text-secondary truncate">
                                    {showSecret ? automation.webhookConfig.secret : "••••••••••••••••••••••••"}
                                </code>
                                <button
                                    onClick={onToggleSecret}
                                    className="rounded p-1 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors"
                                    title={showSecret ? "Hide secret" : "Show secret"}
                                >
                                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                    onClick={() => copyToClipboard(automation.webhookConfig!.secret)}
                                    className="rounded p-1 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors"
                                    title="Copy secret"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                    {automation.webhookConfig?.allowedIps && automation.webhookConfig.allowedIps.length > 0 && (
                        <div>
                            <span className="text-text-muted">Allowed IPs</span>
                            <div className="text-text-primary font-mono mt-1">
                                {automation.webhookConfig.allowedIps.join(", ")}
                            </div>
                        </div>
                    )}
                    <div className="text-[10px] text-text-muted mt-2">
                        Send a POST request with the body signed using HMAC-SHA256.
                        Include the signature in the <code className="bg-bg-elevated px-1 rounded">x-webhook-signature</code> header.
                    </div>
                </div>
            )}

            {/* Git Event info */}
            {automation.triggerType === "git_event" && automation.gitEventConfig && (
                <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        <div>
                            <span className="text-text-muted">Event Types</span>
                            <div className="flex gap-1 mt-1">
                                {automation.gitEventConfig.events.map((evt) => (
                                    <span key={evt} className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-secondary border border-border-subtle">
                                        {evt}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-text-muted">Branch Filter</span>
                            <div className="text-text-primary font-medium mt-1">
                                {automation.gitEventConfig.branches?.length
                                    ? automation.gitEventConfig.branches.join(", ")
                                    : "All branches"}
                            </div>
                        </div>
                    </div>
                    {webhookUrl && (
                        <div>
                            <span className="text-text-muted">Git Webhook URL</span>
                            <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 rounded bg-bg-elevated px-2 py-1 text-[11px] font-mono text-text-secondary truncate">
                                    {webhookUrl}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(webhookUrl)}
                                    className="rounded p-1 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors"
                                    title="Copy URL"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                    {automation.gitEventConfig.secret && (
                        <div>
                            <span className="text-text-muted">Signing Secret</span>
                            <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 rounded bg-bg-elevated px-2 py-1 text-[11px] font-mono text-text-secondary truncate">
                                    {showSecret ? automation.gitEventConfig.secret : "••••••••••••••••••••••••"}
                                </code>
                                <button
                                    onClick={onToggleSecret}
                                    className="rounded p-1 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors"
                                    title={showSecret ? "Hide secret" : "Show secret"}
                                >
                                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                    onClick={() => copyToClipboard(automation.gitEventConfig!.secret)}
                                    className="rounded p-1 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors"
                                    title="Copy secret"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="text-[10px] text-text-muted mt-2">
                        Configure this URL as a webhook in your GitHub/GitLab repository settings.
                        Use the signing secret for payload validation.
                    </div>
                </div>
            )}
        </div>
    );
}
