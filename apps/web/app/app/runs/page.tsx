"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Panel,
    Button,
    SearchInput,
    Badge,
    EmptyState,
    LoadingState,
    ErrorState,
} from "@numezis/ui/components/design-system";
import type { AuditRun, ChainStatus } from "@numezis/shared/chainTypes";
import { PlayCircle } from "lucide-react";

type FilterStatus = "all" | "running" | "completed" | "failed" | "cancelled";

function RunsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [runs, setRuns] = useState<(AuditRun & { chainName: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<FilterStatus>("all");
    const campaignId = searchParams?.get("campaignId");
    const [campaignName, setCampaignName] = useState<string | null>(null);

    useEffect(() => {
        if (!campaignId) {
            setCampaignName(null);
            return;
        }
        let cancelled = false;
        void fetch(`/api/campaigns/${campaignId}`)
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
    }, [campaignId]);

    useEffect(() => {
        void fetchRuns();
    }, [campaignId]);

    const fetchRuns = async () => {
        setLoading(true);
        setError("");
        try {
            const qs = new URLSearchParams();
            if (campaignId) qs.set("campaignId", campaignId);
            const url = `/api/runs${qs.toString() ? `?${qs.toString()}` : ""}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to load execution runs");
            const data = (await res.json()) as { runs: (AuditRun & { chainName: string })[] };
            setRuns(data.runs || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const filteredRuns = runs.filter((run) => {
        if (filter === "running" && run.status !== "RUNNING") return false;
        if (filter === "completed" && run.status !== "COMPLETED") return false;
        if (filter === "failed" && run.status !== "FAILED") return false;
        if (filter === "cancelled" && run.status !== "CANCELLED") return false;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesName = run.chainName.toLowerCase().includes(query);
            const matchesId = run._id?.toString().toLowerCase().includes(query);
            if (!matchesName && !matchesId) return false;
        }

        return true;
    });

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <PlayCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Execution Runs</h1>
                        <p className="text-sm text-text-muted">
                            {campaignId ? (
                                <>
                                    Filtered to{" "}
                                    <span className="text-text-secondary font-medium">
                                        {campaignName || "Campaign"}
                                    </span>{" "}
                                    <span className="font-mono text-text-muted">
                                        ({campaignId.slice(0, 6)}…{campaignId.slice(-3)})
                                    </span>
                                </>
                            ) : (
                                "History of all campaign execution sessions"
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {campaignId && (
                        <>
                            <Button onClick={() => router.push(`/app/campaigns/${campaignId}`)} variant="secondary" size="sm">
                                View campaign
                            </Button>
                            <Button onClick={() => router.push(`/app/history?type=campaign&campaignId=${encodeURIComponent(campaignId)}`)} variant="secondary" size="sm">
                                Back to Activity
                            </Button>
                        </>
                    )}
                    <Button onClick={() => void fetchRuns()} variant="secondary" size="sm">
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <SearchInput
                    placeholder="Search runs by campaign or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    className="flex-1"
                />
                <div className="flex gap-2">
                    <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                        All
                    </FilterButton>
                    <FilterButton active={filter === "running"} onClick={() => setFilter("running")}>
                        Running
                    </FilterButton>
                    <FilterButton active={filter === "completed"} onClick={() => setFilter("completed")}>
                        Completed
                    </FilterButton>
                    <FilterButton active={filter === "failed"} onClick={() => setFilter("failed")}>
                        Failed
                    </FilterButton>
                    <FilterButton active={filter === "cancelled"} onClick={() => setFilter("cancelled")}>
                        Cancelled
                    </FilterButton>
                </div>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 text-text-primary">
                {loading && <LoadingState message="Loading execution runs..." />}

                {error && <ErrorState message={error} onRetry={() => void fetchRuns()} />}

                {!loading && !error && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-6 gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            <div className="col-span-2">Campaign & Run ID</div>
                            <div>Status</div>
                            <div>Started</div>
                            <div>Findings</div>
                            <div className="text-right">Action</div>
                        </div>

                        {filteredRuns.map((run) => (
                            <Panel
                                key={run._id?.toString()}
                                className="group p-4 transition hover:border-border-strong hover:bg-state-hover cursor-pointer"
                                onClick={() => router.push(`/app/runs/${run._id}`)}
                            >
                                <div className="grid grid-cols-6 gap-4 items-center">
                                    <div className="col-span-2 text-left">
                                        <div className="text-sm font-semibold text-text-primary">{run.chainName}</div>
                                        <div className="text-[10px] font-mono text-text-muted truncate">RUNID: {run._id?.toString()}</div>
                                    </div>
                                    <div className="text-left">
                                        <StatusBadge status={run.status} />
                                    </div>
                                    <div className="text-left text-xs text-text-secondary">
                                        {new Date(run.startedAt).toLocaleString(undefined, {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                        })}
                                    </div>
                                    <div className="text-left text-xs text-text-secondary">
                                        {run.aggregatedFindings.length} findings
                                        {run.metadata && (
                                            <div className="text-[10px] text-text-muted">
                                                {run.metadata.totalVerified}/{run.metadata.totalClaims} verified
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/app/campaigns/${run.chainId}`);
                                            }}
                                        >
                                            View Campaign
                                        </Button>
                                    </div>
                                </div>
                            </Panel>
                        ))}

                        {filteredRuns.length === 0 && (
                            <EmptyState
                                variant={searchQuery ? "search" : "no-data"}
                                title={searchQuery ? "No runs match your search" : "No execution runs found"}
                                description={searchQuery ? "Try adjusting your search criteria." : "Execute a campaign to see runs here."}
                            />
                        )}
                    </div>
                )}
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

function StatusBadge({ status }: { status: ChainStatus }) {
    const variantMap: Record<ChainStatus, "completed" | "failed" | "running" | "pending" | "paused" | "default"> = {
        COMPLETED: "completed",
        FAILED: "failed",
        RUNNING: "running",
        PENDING: "pending",
        PAUSED: "paused",
        CANCELLED: "default",
    };

    return (
        <Badge
            variant={variantMap[status]}
            size="sm"
            showIcon={status === "RUNNING"}
            spinning={status === "RUNNING"}
        >
            {status}
        </Badge>
    );
}

export default function RunsPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-text-muted">Loading...</div>}>
            <RunsPageContent />
        </Suspense>
    );
}
