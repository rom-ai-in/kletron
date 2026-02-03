"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuditChain } from "@/src/services/chainTypes";
import { Button } from "@/src/components/ui/Button";
import { ChainBuilderModal } from "@/src/components/ChainBuilderModal";
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
    MoreHorizontal
} from "lucide-react";
import { Panel } from "@/src/components/ui/Panel";
import { cn } from "@/src/utils/cn";

interface ChainDetailPageProps {
    params: { id: string };
}

type Tab = "overview" | "configuration" | "history";

export default function ChainDetailPage({ params }: ChainDetailPageProps) {
    const router = useRouter();
    const [chain, setChain] = useState<AuditChain | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    useEffect(() => {
        void fetchChain();
    }, [params.id]);

    const fetchChain = async () => {
        setLoading(true);
        setError("");
        try {
            const chainRes = await fetch(`/api/campaigns/${params.id}`);
            if (!chainRes.ok) throw new Error("Failed to load campaign");
            const chainData = await chainRes.json();
            setChain(chainData.chain);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        try {
            const res = await fetch(`/api/campaigns/${params.id}/execute`, {
                method: "PUT",
            });
            if (!res.ok) throw new Error("Failed to start execution");
            const data = (await res.json()) as { status?: string; runId?: string };
            if (!data.runId) throw new Error("Execution started but no runId was returned");
            router.push(`/app/runs/${data.runId}`);
        } catch (err: any) {
            alert(`Failed to start chain: ${err.message}`);
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
                        {/* Start / Resume Action */}
                        {(chain.status === "PENDING" || chain.status === "PAUSED") && (
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
                        {(chain.status === "COMPLETED" || chain.status === "FAILED" || chain.status === "CANCELLED") && (
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
                            <StatCard label="Current Status" value={chain.status} status={chain.status} />
                            <StatCard label="Last Run" value="-" /> {/* Placeholder for now */}
                            <StatCard label="Success Rate" value="100%" />
                        </div>

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
                            {chain.stages.map((stage, idx) => (
                                <div key={stage.id} className="group flex items-center gap-4 p-3 rounded-md border border-border-subtle bg-bg-surface hover:border-border-strong transition-colors">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated text-xs font-mono text-text-muted border border-border-subtle group-hover:bg-text-primary group-hover:text-bg-base transition-colors">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-text-primary truncate">{stage.name}</div>
                                        <div className="text-[11px] text-text-muted truncate font-mono mt-0.5">
                                            {stage.promptPath.split('/').pop()} · {stage.llmProvider}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded border border-border-subtle">
                                        {stage.graphId}
                                    </div>
                                </div>
                            ))}
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
                        <ActivityList campaignId={params.id} />
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

function ActivityList({ campaignId }: { campaignId: string }) {
    const router = useRouter();
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        void fetchActivity();
    }, [campaignId]);

    const fetchActivity = async () => {
        setLoading(true);
        setError("");
        try {
            const url = `/api/activity?campaignId=${campaignId}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to load activity history");
            const data = (await res.json()) as { activity: ActivityItem[] };
            setActivity(data.activity || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
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

    if (activity.length === 0) {
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
            {activity.map((item) => (
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

                                <div className="flex items-center justify-end">
                                    <div className="h-7 w-7 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>
            ))}
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
