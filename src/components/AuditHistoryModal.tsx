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
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
                    </div>
                )}

                {error && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
                        Error: {error}
                    </div>
                )}

                {!loading && !error && sessions.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center text-sm text-slate-500">
                        No history entries found.
                    </div>
                )}

                {!loading && !error && sessions.map((session) => (
                    <div
                        key={session._id}
                        className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 p-5 transition hover:border-cyan-500/50 hover:bg-slate-950/80"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={session.status} />
                                    <span className="font-mono text-[10px] text-slate-500">
                                        {new Date(session.startedAt).toLocaleString(undefined, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors line-clamp-2">
                                    {session.prompt}
                                </p>
                            </div>
                        </div>

                        {session.workflowResult?.conclusion && (
                            <div className="mt-4 border-t border-slate-800/50 pt-3">
                                <p className="text-[11px] text-slate-400">
                                    <span className="mr-2 inline-block rounded font-mono text-[9px] uppercase tracking-wider text-slate-600">
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
        COMPLETED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
        FAILED: "bg-rose-500/10 text-rose-300 border-rose-500/30",
        RUNNING: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
        PENDING: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    };

    const className = styles[status as keyof typeof styles] || "bg-slate-800 text-slate-400 border-slate-700";

    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${className}`}>
            {status === "RUNNING" && (
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {status}
        </span>
    );
}
