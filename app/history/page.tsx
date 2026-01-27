"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
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
    MoreHorizontal
} from "lucide-react";
import { StageDetailModal } from "@/src/components/StageDetailModal";

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
                typeParam === "campaign" ? "campaign" : typeParam === "workbench" ? "workbench" : "all";
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
        if (filter === "workbench" && item.type !== "WORKBENCH") return false;
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
                        onClick={() => router.push("/runs")}
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
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search activity by title or conclusion..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated pl-10 pr-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring"
                    />
                </div>
                <div className="flex gap-2">
                    <FilterButton
                        active={filter === "all"}
                        onClick={() =>
                            router.push(
                                `/history?type=all${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ""}`
                            )
                        }
                    >
                        All
                    </FilterButton>
                    <FilterButton
                        active={filter === "workbench"}
                        onClick={() =>
                            router.push(
                                `/history?type=workbench${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ""}`
                            )
                        }
                    >
                        Deep Agent
                    </FilterButton>
                    <FilterButton
                        active={filter === "campaign"}
                        onClick={() =>
                            router.push(
                                `/history?type=campaign${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ""}`
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
                                    onClick={() => router.push(`/campaigns/${campaignId}`)}
                                >
                                    View campaign
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => router.push("/history?type=campaign")}
                                >
                                    Clear filter
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => router.push(`/runs?campaignId=${encodeURIComponent(campaignId)}`)}
                                >
                                    Advanced runs table
                                </Button>
                            </div>
                        </div>
                    )}
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
                        </div>
                    )}

                    {!loading && error && (
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
                            Error: {error}
                        </div>
                    )}

                    {!loading && !error && filteredActivity.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-surface p-20 text-center">
                            <Activity className="mb-4 h-10 w-10 text-text-muted opacity-20" />
                            <p className="text-sm text-text-muted">
                                {searchQuery ? "No activity matches your search." : "No activity history found yet."}
                            </p>
                        </div>
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
                                } else {
                                    router.push(item.link);
                                }
                            }}
                        >
                            <div className="flex items-stretch text-left">
                                {/* Type indicator */}
                                <div className={`w-1 shrink-0 ${item.type === "WORKBENCH" ? "bg-sky-500/40" : "bg-emerald-500/40"
                                    }`} />

                                <div className="flex flex-1 items-center gap-4 p-4 min-w-0">
                                    {/* Column 1: Icon */}
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${item.type === "WORKBENCH"
                                        ? "bg-sky-500/10 border-sky-500/10 text-sky-400"
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
                                            {/* Type Chip */}
                                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${item.type === "WORKBENCH"
                                                ? "bg-sky-500/10 text-sky-400"
                                                : "bg-emerald-500/10 text-emerald-400"
                                                }`}>
                                                {item.type === "WORKBENCH" ? "Deep Agent" : "Campaign"}
                                            </span>

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
        RUNNING: { bg: "bg-sky-500/10", text: "text-sky-400", icon: PlayCircle },
        PENDING: { bg: "bg-bg-elevated", text: "text-text-muted", icon: Clock },
        PAUSED: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Clock },
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
