"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    Search
} from "lucide-react";

type ActivityItem = {
    id: string;
    type: "WORKBENCH" | "CAMPAIGN";
    title: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED";
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

export default function HistoryPage() {
    const router = useRouter();
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");

    useEffect(() => {
        void fetchActivity();
    }, []);

    const fetchActivity = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/activity");
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
                        <h1 className="text-lg font-semibold text-text-primary">System Activity</h1>
                        <p className="text-sm text-text-muted">History of workbench sessions and campaign runs</p>
                    </div>
                </div>
                <Button onClick={() => void fetchActivity()} variant="secondary" size="sm">
                    Refresh
                </Button>
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
                    <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                        All
                    </FilterButton>
                    <FilterButton active={filter === "workbench"} onClick={() => setFilter("workbench")}>
                        Workbench
                    </FilterButton>
                    <FilterButton active={filter === "campaign"} onClick={() => setFilter("campaign")}>
                        Campaigns
                    </FilterButton>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6">
                <div className="space-y-4">
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
                            onClick={() => router.push(item.link)}
                        >
                            <div className="flex items-stretch text-left">
                                {/* Type indicator */}
                                <div className={`flex w-1 items-stretch ${item.type === "WORKBENCH" ? "bg-sky-500/40" : "bg-emerald-500/40"
                                    }`} />

                                <div className="flex flex-1 items-center justify-between gap-4 p-4">
                                    <div className="flex min-w-0 flex-1 items-start gap-4">
                                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.type === "WORKBENCH" ? "bg-sky-500/10 text-sky-400" : "bg-emerald-500/10 text-emerald-400"
                                            }`}>
                                            {item.type === "WORKBENCH" ? <Terminal className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-text-primary">
                                                    {item.title}
                                                </h3>
                                                <StatusBadge status={item.status} />
                                            </div>

                                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(item.startedAt).toLocaleString(undefined, {
                                                        dateStyle: "medium",
                                                        timeStyle: "short"
                                                    })}
                                                </span>
                                                <span className="font-mono opacity-60">
                                                    {item.type === "WORKBENCH" ? "Workbench Run" : "Campaign Execution"}
                                                </span>
                                                {item.metadata?.totalFindings !== undefined && (
                                                    <span className="flex items-center gap-1 text-text-secondary">
                                                        {item.metadata.totalFindings} findings
                                                    </span>
                                                )}
                                            </div>

                                            {item.conclusion && (
                                                <p className="mt-2 line-clamp-1 text-xs text-text-secondary italic">
                                                    "{item.conclusion}"
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-4">
                                        <ChevronRight className="h-4 w-4 text-text-muted opacity-0 transition group-hover:opacity-100" />
                                    </div>
                                </div>
                            </div>
                        </Panel>
                    ))}
                </div>
            </div>
        </div>
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
