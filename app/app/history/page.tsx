"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

import {
    Panel,
    Button,
    Badge,
    SearchInput,
    LoadingState,
    ErrorState,
    EmptyState,
} from "@/src/components/design-system";
import {
    Terminal,
    Layers,
    Activity,
    ChevronRight,
    Clock,
    AlertCircle,
    CheckCircle2,
    PlayCircle,
    Search,
    MoreHorizontal,
    GitBranch
} from "lucide-react";
import { StageDetailModal } from "@/src/components/StageDetailModal";
import { AgentGraphRunModal } from "@/src/components/AgentGraphRunModal";

type ActivityItem = {
    id: string;
    type: "WORKBENCH" | "CAMPAIGN" | "AGENT_GRAPH";
    title: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED" | "CANCELLED";
    startedAt: string;
    endedAt?: string;
    conclusion?: string;
    graphId?: string;
    metadata?: {
        totalFindings?: number;
        totalClaims?: number;
        totalVerified?: number;
        totalDuration?: number;
        nodeCount?: number;
        completedNodes?: number;
        failedNodes?: number;
        nodeSessionIds?: Record<string, string>;
        nodeStatuses?: Record<string, string>;
        nodeOrder?: string[];
        totalTokens?: number;
    };
    link: string;
};

/** Format token count to human readable string */
function formatTokenCount(count: number): string {
    if (count < 1000) return String(count);
    if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
    return `${Math.round(count / 1000)}k`;
}

type FilterType = "all" | "workbench" | "campaign";

function HistoryPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [campaignId, setCampaignId] = useState<string | null>(null);
    const [campaignName, setCampaignName] = useState<string | null>(null);
    const [selectedSession, setSelectedSession] = useState<{ id: string; title: string, status: string } | null>(null);
    const [selectedGraphRun, setSelectedGraphRun] = useState<ActivityItem | null>(null);

    useEffect(() => {
        const id = searchParams?.get("campaignId");
        if (!id) {
            setCampaignName(null);
            return;
        }
        let cancelled = false;
        void fetch(`/api/campaigns/${id}`)
            .then(async (res) => {
                if (!res.ok) return null;
                const data = (await res.json()) as { chain?: { name?: string } };
                return data.chain?.name || null;
            })
            .then((name) => {
                if (!cancelled) setCampaignName(name);
            })
            .catch(() => {
                if (!cancelled) setCampaignName(null);
            });
        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    useEffect(() => {
        void fetchActivity();
    }, [searchParams]);

    const fetchActivity = async () => {
        setLoading(true);
        setError("");
        try {
            const typeParam = (searchParams?.get("type") || "").toLowerCase();
            const nextFilter: FilterType =
                typeParam === "campaign" ? "campaign" :
                    (typeParam === "workbench" || typeParam === "agent_graph") ? "workbench" : "all";
            setFilter(nextFilter);

            const campaignIdParam = searchParams?.get("campaignId");
            setCampaignId(campaignIdParam || null);

            const qs = new URLSearchParams();
            if (campaignIdParam) qs.set("campaignId", campaignIdParam);
            const url = `/api/activity${qs.toString() ? `?${qs.toString()}` : ""}`;

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

    const filteredActivity = activity.filter((item) => {
        // Deep Agent filter shows both standalone workbench sessions AND agent graph runs
        if (filter === "workbench" && item.type !== "WORKBENCH" && item.type !== "AGENT_GRAPH") return false;
        if (filter === "campaign" && item.type !== "CAMPAIGN") return false;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesTitle = item.title.toLowerCase().includes(query);
            const matchesConclusion = item.conclusion?.toLowerCase().includes(query);
            if (!matchesTitle && !matchesConclusion) return false;
        }

        return true;
    });

    return (
        <div className="flex h-full flex-col bg-bg-app">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Activity</h1>
                        <p className="text-sm text-text-muted">History of deep agent sessions and campaign runs</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => router.push("/app/runs")}
                        variant="secondary"
                        size="sm"
                    >
                        Advanced runs table
                    </Button>
                    <Button onClick={() => void fetchActivity()} variant="secondary" size="sm">
                        Refresh
                    </Button>
                </div>
            </div>

            {/* FIlter bar */}
            <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <SearchInput
                    placeholder="Search activity by title or conclusion..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    className="flex-1"
                />
                <div className="flex gap-2">
                    <FilterButton
                        active={filter === "all"}
                        onClick={() =>
                            router.push(
                                `/app/history?type=all${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ""}`
                            )
                        }
                    >
                        All
                    </FilterButton>
                    <FilterButton
                        active={filter === "workbench"}
                        onClick={() =>
                            router.push(
                                `/app/history?type=workbench${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ""}`
                            )
                        }
                    >
                        Deep Agent
                    </FilterButton>

                    <FilterButton
                        active={filter === "campaign"}
                        onClick={() =>
                            router.push(
                                `/app/history?type=campaign${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ""}`
                            )
                        }
                    >
                        Campaigns
                    </FilterButton>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6">
                <div className="space-y-4">
                    {campaignId && (
                        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface p-3">
                            <div className="text-xs text-text-secondary">
                                Filtered to campaign{" "}
                                <span className="text-text-primary font-medium">
                                    {campaignName || "Campaign"}
                                </span>{" "}
                                <span className="font-mono text-text-muted">
                                    ({campaignId.slice(0, 6)}…{campaignId.slice(-3)})
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => router.push(`/app/campaigns/${campaignId}`)}
                                >
                                    View campaign
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => router.push("/app/history?type=campaign")}
                                >
                                    Clear filter
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => router.push(`/app/runs?campaignId=${encodeURIComponent(campaignId)}`)}
                                >
                                    Advanced runs table
                                </Button>
                            </div>
                        </div>
                    )}
                    {loading && <LoadingState message="Loading activity history..." />}

                    {!loading && error && <ErrorState message={error} onRetry={() => void fetchActivity()} />}

                    {!loading && !error && filteredActivity.length === 0 && (
                        <EmptyState
                            icon={<Activity className="h-10 w-10" />}
                            variant={searchQuery ? "search" : "no-data"}
                            title={searchQuery ? "No activity matches your search" : "No activity history found yet"}
                            description={searchQuery ? "Try adjusting your search criteria." : "Start a deep agent session or campaign to see activity here."}
                        />
                    )}

                    {!loading && !error && filteredActivity.map((item) => (
                        <Panel
                            key={`${item.type}-${item.id}`}
                            className="group relative cursor-pointer overflow-hidden p-0 transition hover:border-border-strong hover:bg-state-hover"
                            onClick={() => {
                                if (item.type === "WORKBENCH") {
                                    setSelectedSession({
                                        id: item.id,
                                        title: item.title,
                                        status: item.status
                                    });
                                } else if (item.type === "AGENT_GRAPH") {
                                    setSelectedGraphRun(item);
                                } else {
                                    router.push(item.link);
                                }
                            }}
                        >
                            <div className="flex items-stretch text-left">
                                {/* Type indicator */}
                                <div className={`w-1 shrink-0 ${item.type === "WORKBENCH" ? "bg-zinc-400/40" :
                                    item.type === "AGENT_GRAPH" ? "bg-zinc-500/40" :
                                        "bg-emerald-500/40"
                                    }`} />

                                <div className="flex flex-1 items-center gap-4 p-4 min-w-0">
                                    {/* Column 1: Icon */}
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${item.type === "WORKBENCH"
                                        ? "bg-zinc-400/10 border-zinc-400/10 text-zinc-300"
                                        : item.type === "AGENT_GRAPH"
                                            ? "bg-zinc-500/10 border-zinc-500/10 text-zinc-400"
                                            : "bg-emerald-500/10 border-emerald-500/10 text-emerald-400"
                                        }`}>
                                        {item.type === "WORKBENCH" ? <Terminal className="h-5 w-5" /> :
                                            item.type === "AGENT_GRAPH" ? <GitBranch className="h-5 w-5" /> :
                                                <Layers className="h-5 w-5" />}
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
                                            {/* Type Chip */}
                                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${item.type === "WORKBENCH"
                                                ? "bg-zinc-400/10 text-zinc-300"
                                                : item.type === "AGENT_GRAPH"
                                                    ? "bg-zinc-500/10 text-zinc-400"
                                                    : "bg-emerald-500/10 text-emerald-400"
                                                }`}>
                                                {item.type === "WORKBENCH" ? "Deep Agent" :
                                                    item.type === "AGENT_GRAPH" ? "Agent Graph" :
                                                        "Campaign"}
                                            </span>

                                            {/* Node count for Agent Graph */}
                                            {item.type === "AGENT_GRAPH" && item.metadata?.nodeCount !== undefined && (
                                                <span className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">
                                                    <GitBranch className="h-3 w-3" />
                                                    {item.metadata.completedNodes}/{item.metadata.nodeCount} nodes
                                                </span>
                                            )}

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

                                            {/* Token Usage Chip */}
                                            {item.type === "AGENT_GRAPH" && item.metadata?.totalTokens && item.metadata.totalTokens > 0 && (
                                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400" title={`${item.metadata.totalTokens} tokens consumed`}>
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {formatTokenCount(item.metadata.totalTokens)} tokens
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                }}
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                            <ChevronRight className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Panel>
                    ))}
                </div>
            </div>

            {selectedSession && (
                <StageDetailModal
                    isOpen={!!selectedSession}
                    onClose={() => setSelectedSession(null)}
                    stageId={selectedSession.id}
                    stageName={selectedSession.title}
                    sessionId={selectedSession.id}
                    status={selectedSession.status}
                />
            )}

            {selectedGraphRun && (
                <AgentGraphRunModal
                    isOpen={!!selectedGraphRun}
                    onClose={() => setSelectedGraphRun(null)}
                    runId={selectedGraphRun.id}
                    graphName={selectedGraphRun.title}
                    status={selectedGraphRun.status}
                    metadata={selectedGraphRun.metadata as any}
                />
            )}
        </div >
    );
}

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${active
                ? "bg-state-selected text-text-primary"
                : "text-text-muted hover:bg-state-hover hover:text-text-secondary"
                }`}
        >
            {children}
        </button>
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

export default function HistoryPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-text-muted">Loading...</div>}>
            <HistoryPageContent />
        </Suspense>
    );
}
