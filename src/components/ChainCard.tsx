"use client";

import type { AuditChain, ChainStatus } from "../services/chainTypes";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";

interface ChainCardProps {
    chain: AuditChain;
    onView?: () => void;
    onEdit?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onDelete?: () => void;
}

export function ChainCard({ chain, onView, onEdit, onPause, onStop, onDelete }: ChainCardProps) {
    const progress =
        chain.stages.length > 0
            ? ((chain.currentStageIndex / chain.stages.length) * 100).toFixed(0)
            : 0;

    const duration = chain.metadata?.totalDuration
        ? (chain.metadata.totalDuration / 1000 / 60).toFixed(1)
        : null;

    return (
        <Panel className="group p-4 transition hover:border-border-strong hover:bg-state-hover">
            <div className="flex items-start justify-between">
                {/* Left: Chain info */}
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-text-primary group-hover:text-text-primary transition">
                            {chain.name}
                        </h3>
                        <ChainStatusBadge status={chain.status} />
                        {chain.status === "RUNNING" && (
                            <span className="text-sm text-text-muted">
                                {chain.currentStageIndex + 1}/{chain.stages.length}
                            </span>
                        )}
                    </div>

                    {chain.description && (
                        <p className="text-sm text-text-muted line-clamp-2">{chain.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span>{chain.stages.length} audit stages</span>
                        {duration && <span>{duration}m</span>}
                        {chain.metadata?.totalClaims && (
                            <span>
                                {chain.metadata.totalVerified}/{chain.metadata.totalClaims} verified
                            </span>
                        )}
                        {chain.schedule?.enabled && (
                            <span className="flex items-center gap-1">
                                🕐 {chain.schedule.cron}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={onView}>
                        View
                    </Button>
                    {chain.status !== "RUNNING" && onEdit && (
                        <Button size="sm" variant="secondary" onClick={onEdit}>
                            Edit
                        </Button>
                    )}
                    {chain.status === "RUNNING" && onPause && (
                        <Button size="sm" variant="secondary" onClick={onPause}>
                            Pause
                        </Button>
                    )}
                    {chain.status === "RUNNING" && onStop && (
                        <Button size="sm" variant="danger" onClick={onStop}>
                            Stop
                        </Button>
                    )}
                    {chain.status !== "RUNNING" && onDelete && (
                        <Button size="sm" variant="danger" onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to delete this campaign?")) {
                                onDelete();
                            }
                        }}>
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress bar (only for running chains) */}
            {chain.status === "RUNNING" && (
                <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}
        </Panel>
    );
}

function ChainStatusBadge({ status }: { status: ChainStatus }) {
    const styles: Record<ChainStatus, string> = {
        COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        RUNNING: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
        PAUSED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
