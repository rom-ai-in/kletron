"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AutomationDefinition, AutomationTriggerType } from "@kletron/shared/automationTypes";
import type { AutomationExecutionContextDTO } from "@kletron/shared/automationExecutionContext";
import { AutomationExecutionContextPanel, Button, Panel, Skeleton } from "@kletron/ui";
import { AutomationBuilderModal } from "@kletron/ui/components/AutomationBuilderModal";
import { describeCron } from "@kletron/shared/cronUtils";

const PROVIDER_LABELS: Record<string, string> = {
    azure: "Azure OpenAI",
    openai: "OpenAI",
    claude: "Claude",
    gemini: "Gemini",
    lmstudio: "LM Studio",
    ollama: "Ollama",
    vllm: "vLLM",
};
import {
    Play,
    Edit2,
    History,
    ArrowLeft,
    Settings,
    Activity,
    CheckCircle2,
    ChevronRight,
    Clock,
    AlertCircle,
    PlayCircle,
    RefreshCw,
    Webhook,
    GitBranch,
    Timer,
    Hand,
    Copy,
    Eye,
    EyeOff,
    Trash2,
    Bot,
} from "lucide-react";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { cn } from "@kletron/shared/utils/cn";

interface AutomationDetailPageProps {
    params: { id: string };
}

type Tab = "overview" | "trigger" | "configuration" | "history";

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

function AutomationDetailPageSkeleton() {
    return (
        <div className="flex flex-col h-full bg-bg-surface">
            <div className="flex flex-col border-b border-border-subtle/40 bg-bg-surface px-6 pt-5 pb-0 gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0 max-w-2xl">
                        <Skeleton className="h-8 w-[min(100%,20rem)]" height="h-8" />
                        <Skeleton className="h-3 w-full" height="h-3" radius="rounded-md" />
                        <Skeleton className="h-3 w-4/5 max-w-lg" height="h-3" radius="rounded-md" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Skeleton className="w-28" height="h-8" radius="rounded-md" />
                        <Skeleton className="w-8" height="h-8" radius="rounded-md" />
                        <Skeleton className="w-8" height="h-8" radius="rounded-md" />
                    </div>
                </div>
                <div className="flex items-center gap-6 mt-2 pb-1">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="w-24" height="h-7" radius="rounded-md" />
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 bg-bg-base/30">
                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-lg bg-bg-elevated/30 p-4 space-y-2 border-0">
                                <Skeleton className="w-20" height="h-3" radius="rounded" />
                                <Skeleton className="w-12" height="h-6" radius="rounded-md" />
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg bg-bg-elevated/25 p-4 space-y-3 border-0">
                        <Skeleton className="w-40" height="h-4" radius="rounded-md" />
                        <Skeleton className="w-full" height="h-3" radius="rounded" />
                        <Skeleton className="w-full" height="h-3" radius="rounded" />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="w-full" height="h-14" radius="rounded-md" />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Skeleton className="w-36 ml-1" height="h-3" radius="rounded" />
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="flex items-center gap-4 p-3 rounded-md bg-bg-elevated/30 border-0"
                            >
                                <Skeleton className="w-6 shrink-0" height="h-6" radius="rounded-full" />
                                <div className="flex-1 space-y-2 min-w-0">
                                    <Skeleton className="w-3/5 max-w-xs" height="h-4" radius="rounded-md" />
                                    <Skeleton className="w-full" height="h-3" radius="rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ExecutionContextPanelSkeleton() {
    return (
        <div className="rounded-lg bg-bg-elevated/25 p-4 space-y-3 border-0">
            <div className="flex items-start gap-2">
                <Skeleton className="w-4 shrink-0" height="h-4" radius="rounded" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="w-24" height="h-3" />
                    <Skeleton className="w-2/3 max-w-sm" height="h-4" />
                    <Skeleton className="w-full max-w-xl" height="h-3" />
                </div>
            </div>
            <Skeleton className="w-full" height="h-16" radius="rounded-md" />
            <div className="space-y-2">
                <Skeleton className="w-40" height="h-3" />
                <Skeleton className="w-full" height="h-20" radius="rounded-md" />
                <Skeleton className="w-full" height="h-20" radius="rounded-md" />
            </div>
            <p className="text-[10px] text-text-muted pt-1">Loading workspace capabilities and stage tools…</p>
        </div>
    );
}

export default function AutomationDetailPage({ params }: AutomationDetailPageProps) {
    const { activeWorkspaceId, activeWorkspace } = useWorkspace() ?? {};
    const fetchWithWorkspace = async (url: string, init?: RequestInit) => {
        const headers: Record<string, string> = { ...init?.headers as Record<string, string> };
        if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
        return fetch(url, { ...init, headers });
    };
    const router = useRouter();
    const [automation, setAutomation] = useState<AutomationDefinition | null>(null);
    const [loadingAutomation, setLoadingAutomation] = useState(true);
    const [loadingExecutionContext, setLoadingExecutionContext] = useState(true);
    const [error, setError] = useState("");
    const [executeError, setExecuteError] = useState("");
    const [executing, setExecuting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [executionContext, setExecutionContext] = useState<AutomationExecutionContextDTO | null>(null);
    const [executionContextError, setExecutionContextError] = useState("");

    useEffect(() => {
        setAutomation(null);
        setExecutionContext(null);
        setExecutionContextError("");
        setError("");
        void fetchAutomation();
    }, [params.id, activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchAutomation = async () => {
        setLoadingAutomation(true);
        setLoadingExecutionContext(true);
        setError("");
        setExecuteError("");
        setExecutionContextError("");

        // Start execution-context immediately in parallel with automation (same total time as the slowest call).
        const contextPromise = fetchWithWorkspace(`/api/automations/${params.id}/execution-context`);

        try {
            const res = await fetchWithWorkspace(`/api/automations/${params.id}`);
            if (!res.ok) {
                const msg = res.status === 404 ? "Automation not found" : "Failed to load automation";
                throw new Error(msg);
            }
            const data = await res.json();
            setAutomation(data.automation);
            if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setAutomation(null);
            setLoadingExecutionContext(false);
            return;
        } finally {
            setLoadingAutomation(false);
        }

        try {
            const ctxRes = await contextPromise;
            if (ctxRes.ok) {
                const ctxData = (await ctxRes.json()) as { executionContext?: AutomationExecutionContextDTO };
                setExecutionContext(ctxData.executionContext ?? null);
                setExecutionContextError("");
            } else {
                setExecutionContext(null);
                setExecutionContextError("Could not load execution context for this workspace.");
            }
        } catch {
            setExecutionContext(null);
            setExecutionContextError("Could not load execution context for this workspace.");
        } finally {
            setLoadingExecutionContext(false);
        }
    };

    const handleExecute = async () => {
        try {
            setExecuteError("");
            setExecuting(true);
            const res = await fetchWithWorkspace(`/api/automations/${params.id}/execute`, {
                method: "PUT",
            });
            const data = (await res.json().catch(() => ({}))) as { status?: string; threadId?: string; error?: string; details?: any[] };
            if (!res.ok) {
                const detailText = Array.isArray(data.details)
                    ? data.details
                        .map((d: any) => (d?.stageName ? `${d.stageName} (stage ${d.index + 1})` : d?.stageId || String(d)))
                        .join(", ")
                    : "";
                const message = data.error || "Failed to start execution";
                throw new Error(detailText ? `${message} — ${detailText}` : message);
            }
            if (!data.threadId) throw new Error("Execution started but no threadId was returned");
            router.push(`/app/agent?sessionId=${data.threadId}`);
        } catch (err: any) {
            setExecuteError(err.message || "Failed to start automation");
        } finally {
            setExecuting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this automation? This action cannot be undone.")) return;
        try {
            setDeleting(true);
            const res = await fetchWithWorkspace(`/api/automations/${params.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as any).error || "Failed to delete automation");
            }
            router.push("/app/automations");
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        } finally {
            setDeleting(false);
        }
    };

    if (loadingAutomation && !automation) {
        return <AutomationDetailPageSkeleton />;
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
    const totalStages = automation.stages.length;
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

            {/* Header */}
            <div className="flex flex-col border-b border-border-subtle bg-bg-surface px-6 pt-5 pb-0 gap-4">
                <div className="flex items-start justify-between">
                    <div className="min-w-0 space-y-1">
                        {/* The list lives on /app/automations now — no master rail to fall back on. */}
                        <button
                            type="button"
                            onClick={() => router.push("/app/automations")}
                            className="-ml-1 mb-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-text-muted transition-colors hover:bg-state-hover hover:text-text-primary"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Automation
                        </button>
                        <h1 className="text-xl font-bold tracking-tight text-text-primary">{automation.name}</h1>
                        <p className="text-xs text-text-muted max-w-2xl">{automation.description || "No description provided."}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isBlocked && (
                            <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} className="gap-2 border-status-warning-border text-status-warning-text">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Fix Prompts
                            </Button>
                        )}

                        {!isBlocked && (
                            <Button
                                size="sm"
                                onClick={() => void handleExecute()}
                                loading={executing}
                                className="gap-2 bg-status-success hover:bg-status-success text-white border-transparent"
                            >
                                <Play className="h-3.5 w-3.5" />
                                Run Automation
                            </Button>
                        )}

                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} title="Edit Configuration">
                            <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                            title="Delete Automation"
                            className="gap-2 text-status-error-text hover:bg-status-error-bg hover:border-status-error-border"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

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
                        label="Run History"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 bg-bg-base/30">
                {activeTab === "overview" && (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        <div className="grid grid-cols-3 gap-4">
                            <StatCard label="Total Stages" value={automation.stages.length} />
                            <StatCard label="Trigger" value={triggerTypeLabel(automation.triggerType)} />
                            <StatCard
                                label="Workspace"
                                value={
                                    executionContext?.workspaceName
                                        ?? activeWorkspace?.name
                                        ?? (activeWorkspaceId ? `${activeWorkspaceId.slice(0, 8)}…` : "—")
                                }
                            />
                        </div>

                        {loadingExecutionContext && !executionContext && !executionContextError && (
                            <ExecutionContextPanelSkeleton />
                        )}
                        {executionContextError && (
                            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg/40 px-3 py-2 text-xs text-status-warning-text">
                                {executionContextError}
                            </div>
                        )}
                        {executionContext && (
                            <AutomationExecutionContextPanel
                                context={executionContext}
                                activeWorkspaceId={activeWorkspaceId}
                                connectorsHref="/app/connectors"
                            />
                        )}

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

                        <div className="rounded-lg border border-status-info-border bg-status-info-bg/40 p-4">
                            <div className="flex items-start gap-3">
                                <Bot className="h-4 w-4 text-status-info-text mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-text-secondary">
                                    Running this automation creates an agent thread you can open from the
                                    {" "}<button onClick={() => router.push("/app/agent")} className="underline text-status-info-text">Agent page</button>.
                                    {totalStages > 1 && (
                                        <> Each stage appears as a successive turn within the conversation.</>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-text-muted ml-1">Pipeline Stages</div>
                            {automation.stages.map((stage, idx) => {
                                const promptMissing = !stage.prompt || stage.prompt.trim() === "";
                                return (
                                    <div key={stage.id} className="group flex items-center gap-4 p-3 rounded-md border border-border-subtle bg-bg-surface hover:border-border-strong transition-colors">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono border bg-bg-elevated text-text-muted border-border-subtle">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-text-primary truncate">{stage.name}</div>
                                            <div className="text-[11px] text-text-muted truncate font-mono mt-0.5">
                                                {PROVIDER_LABELS[stage.llmProvider] ?? stage.llmProvider}
                                            </div>
                                            <div className={`text-[11px] truncate font-mono mt-0.5 ${promptMissing ? "text-status-error-text" : "text-text-muted"}`}>
                                                {promptMissing ? "Missing prompt" : stage.prompt}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {promptMissing && (
                                                <span className="text-[10px] px-2 py-0.5 rounded border bg-status-warning-bg text-status-warning-text border-status-warning-border">
                                                    BLOCKED
                                                </span>
                                            )}
                                            <span className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded border border-border-subtle">
                                                {stage.graphId}
                                            </span>
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
                    <div className="max-w-4xl mx-auto space-y-4">
                        {executionContext && (
                            <div className="rounded-lg border border-status-info-border bg-status-info-bg/30 px-4 py-3 text-xs text-text-secondary">
                                Connectors, skills, and per-stage tools are summarized under{" "}
                                <button
                                    type="button"
                                    className="text-status-info-text underline"
                                    onClick={() => setActiveTab("overview")}
                                >
                                    Overview
                                </button>
                                . Raw JSON below is the saved automation document only.
                            </div>
                        )}
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
                        <AutomationThreadsList automationId={params.id} />
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
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon?: React.ReactNode;
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
        </button>
    );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{label}</span>
            <span className="text-xl font-medium tracking-tight text-text-primary">{value}</span>
        </div>
    );
}

type AutomationThread = {
    id: string;
    title: string;
    status: string;
    startedAt: string;
    endedAt?: string | null;
    link: string;
    type: string;
};

function AutomationThreadsList({ automationId }: { automationId: string }) {
    const { activeWorkspaceId } = useWorkspace() ?? {};
    const fetchWithWorkspace = async (url: string, init?: RequestInit) => {
        const headers: Record<string, string> = { ...init?.headers as Record<string, string> };
        if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
        return fetch(url, { ...init, headers });
    };
    const router = useRouter();
    const [threads, setThreads] = useState<AutomationThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    const fetchThreads = async (background = false) => {
        if (background) setRefreshing(true); else setLoading(true);
        try {
            const params = new URLSearchParams({
                automationId,
                type: "automation",
                limit: "50",
            });
            if (activeWorkspaceId) params.set("workspaceId", activeWorkspaceId);
            const res = await fetchWithWorkspace(`/api/history/runs?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load history");
            const data = (await res.json()) as { runs: AutomationThread[] };
            setThreads(Array.isArray(data.runs) ? data.runs : []);
            setError("");
        } catch (err) {
            if (!background) setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            if (background) setRefreshing(false); else setLoading(false);
        }
    };

    useEffect(() => {
        void fetchThreads();
    }, [automationId, activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    if (threads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-surface p-20 text-center">
                <Activity className="mb-4 h-10 w-10 text-text-muted opacity-20" />
                <p className="text-sm text-text-muted">No runs yet for this automation.</p>
                <p className="text-xs text-text-muted mt-1">Click "Run Automation" above to start one.</p>
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
                    onClick={() => void fetchThreads(true)}
                    className="gap-2 text-[10px] h-7"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                    Refresh
                </Button>
            </div>
            {threads.map((thread) => (
                <Panel
                    key={thread.id}
                    className="group cursor-pointer transition hover:border-border-strong hover:bg-state-hover"
                    onClick={() => router.push(thread.link)}
                >
                    <div className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-status-success-bg border-status-success-border text-status-success-text">
                            <Bot className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="truncate text-sm font-semibold text-text-primary" title={thread.title}>
                                {thread.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                                    <Clock className="h-3 w-3" />
                                    {thread.startedAt
                                        ? new Date(thread.startedAt).toLocaleString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                          })
                                        : "—"}
                                </span>
                                <span className="text-[10px] font-mono text-text-muted truncate">{thread.id}</span>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge status={thread.status} />
                            <ChevronRight className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                    </div>
                </Panel>
            ))}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, { bg: string; text: string; icon: any }> = {
        COMPLETED: { bg: "bg-status-success-bg", text: "text-status-success-text", icon: CheckCircle2 },
        FAILED: { bg: "bg-status-error-bg", text: "text-status-error-text", icon: AlertCircle },
        RUNNING: { bg: "bg-zinc-400/10", text: "text-zinc-300", icon: PlayCircle },
        PENDING: { bg: "bg-bg-elevated", text: "text-text-muted", icon: Clock },
        PAUSED: { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Clock },
        CANCELLED: { bg: "bg-zinc-500/10", text: "text-zinc-300", icon: AlertCircle },
    };
    const config = styles[status?.toUpperCase()] || styles.PENDING;
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

function TriggerTab({
    automation,
    webhookUrl,
    onUpdate,
}: {
    automation: AutomationDefinition;
    webhookUrl: string | null;
    onUpdate: () => void;
}) {
    const { activeWorkspaceId } = useWorkspace() ?? {};
    const fetchWithWorkspace = async (url: string, init?: RequestInit) => {
        const headers: Record<string, string> = { ...init?.headers as Record<string, string> };
        if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
        return fetch(url, { ...init, headers });
    };
    const currentTrigger: AutomationTriggerType = automation.triggerType || "manual";
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    const [triggerType, setTriggerType] = useState<AutomationTriggerType>(currentTrigger);
    const [cronExpr, setCronExpr] = useState(automation.schedule?.cron || "0 9 * * *");
    const [timezone, setTimezone] = useState(automation.schedule?.timezone || "UTC");
    const [maxRuns, setMaxRuns] = useState<number | undefined>(automation.schedule?.maxRuns);
    const [gitEvents, setGitEvents] = useState<("push" | "pull_request" | "tag")[]>(automation.gitEventConfig?.events || ["push"]);
    const [gitBranches, setGitBranches] = useState(automation.gitEventConfig?.branches?.join(", ") || "");
    const [allowedIps, setAllowedIps] = useState(automation.webhookConfig?.allowedIps?.join(", ") || "");

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
            const res = await fetchWithWorkspace(`/api/automations/${automation._id}`, {
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
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">Trigger Type</h3>
                <div className="grid grid-cols-2 gap-3">
                    {TRIGGER_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTriggerType(opt.id)}
                            className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-all ${triggerType === opt.id
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
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${(preset.value !== "" && cronExpr === preset.value) || (preset.value === "" && !isPresetCron && cronExpr !== "")
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

            {triggerType === "webhook" && (
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary">Webhook Configuration</h4>

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
                                        <button onClick={() => copyToClipboard(automation.webhookConfig!.secret!)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title="Copy secret">
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {automation.triggerType !== "webhook" && (
                        <div className="rounded-lg bg-bg-elevated/50 border border-border-subtle p-3 text-xs text-text-muted">
                            Save to generate a signing secret and webhook URL.
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
                                        className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${selected
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
                                        <button onClick={() => copyToClipboard(automation.gitEventConfig!.secret!)} className="rounded-lg p-2 hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors border border-border-subtle" title="Copy secret">
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

            {triggerType === "manual" && (
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
                    <div className="flex items-center gap-3 text-text-muted">
                        <Hand className="h-5 w-5" />
                        <div>
                            <div className="text-sm font-medium text-text-primary">Manual Trigger</div>
                            <div className="text-xs text-text-muted mt-0.5">This automation runs only when you click "Run Automation" above.</div>
                        </div>
                    </div>
                </div>
            )}

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
                </div>
            )}

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
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                </div>
            )}
        </div>
    );
}
