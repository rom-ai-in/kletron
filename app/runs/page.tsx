"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import type { AuditRun, ChainStatus } from "@/src/services/chainTypes";
import { PlayCircle, Search } from "lucide-react";

type FilterStatus = "all" | "running" | "completed" | "failed";

export default function RunsPage() {
    const router = useRouter();
    const [runs, setRuns] = useState<(AuditRun & { chainName: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<FilterStatus>("all");

    useEffect(() => {
        void fetchRuns();
    }, []);

    const fetchRuns = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/runs");
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
                        <p className="text-sm text-text-muted">History of all campaign execution sessions</p>
                    </div>
                </div>
                <Button onClick={() => void fetchRuns()} variant="secondary" size="sm">
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search runs by campaign or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated pl-10 pr-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring"
                    />
                </div>
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
                </div>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 text-text-primary">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
                        Error: {error}
                    </div>
                )}

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
                                onClick={() => router.push(`/runs/${run._id}`)}
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
                                                router.push(`/chains/${run.chainId}`);
                                            }}
                                        >
                                            View Campaign
                                        </Button>
                                    </div>
                                </div>
                            </Panel>
                        ))}

                        {filteredRuns.length === 0 && (
                            <div className="rounded-lg border border-dashed border-border-subtle p-12 text-center text-sm text-text-muted">
                                {searchQuery ? "No runs match your search" : "No execution runs found."}
                            </div>
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
    const styles: Record<ChainStatus, string> = {
        COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        RUNNING: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
        PAUSED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
