"use client";

import { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";

type AuditSessionSummary = {
    _id: string;
    prompt: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    startedAt: string;
    endedAt?: string;
    workflowResult?: {
        conclusion?: string;
    };
};

interface AuditHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AuditHistoryModal({ isOpen, onClose }: AuditHistoryModalProps) {
    const [sessions, setSessions] = useState<AuditSessionSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchSessions();
        }
    }, [isOpen]);

    const fetchSessions = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/audits");
            if (!res.ok) throw new Error("Failed to load history");
            const data = await res.json();
            setSessions(data);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="System Activity"
            subtitle="Audit History"
        >
            <div className="space-y-4">
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

                {!loading && !error && sessions.length === 0 && (
                    <div className="rounded-lg border border-border-subtle bg-bg-surface p-8 text-center text-sm text-text-muted">
                        No history entries found.
                    </div>
                )}

                {!loading && !error && sessions.map((session) => (
                    <div
                        key={session._id}
                        className="group relative overflow-hidden rounded-lg border border-border-subtle bg-bg-surface p-4 transition hover:border-border-strong hover:bg-state-hover"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={session.status} />
                                    <span className="font-mono text-[10px] text-text-muted">
                                        {new Date(session.startedAt).toLocaleString(undefined, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors line-clamp-2">
                                    {session.prompt}
                                </p>
                            </div>
                        </div>

                        {session.workflowResult?.conclusion && (
                            <div className="mt-3 border-t border-border-subtle pt-2">
                                <p className="text-[11px] text-text-muted">
                                    <span className="mr-2 inline-block rounded font-mono text-[9px] uppercase tracking-wider text-text-secondary">
                                        Conclusion
                                    </span>
                                    {session.workflowResult.conclusion}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Modal>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        RUNNING: "bg-bg-elevated text-text-primary border-border-strong",
        PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
    };

    const className = styles[status as keyof typeof styles] || "bg-bg-elevated text-text-muted border-border-subtle";

    return (
        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${className}`}>
            {status === "RUNNING" && (
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {status}
        </span>
    );
}
