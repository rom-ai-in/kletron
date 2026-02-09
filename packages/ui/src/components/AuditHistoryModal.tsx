"use client";

import { useState, useEffect } from "react";
import { Modal, Skeleton } from "@numezis/ui/components/design-system";

type AuditSessionSummary = {
    _id: string;
    prompt: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    startedAt: string;
    endedAt?: string;
    workflowResult?: {
        conclusion?: string;
        outputs?: {
            stageMetrics?: Array<{
                stageId: string;
                stageLabel: string;
                findings: number;
                claims: number;
                verified: number;
            }>;
        }
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
            void fetchSessions();
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
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-5 w-20" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                    <Skeleton className="h-5 w-3/4" />
                                    <div className="border-t border-border-subtle pt-2 mt-3">
                                        <Skeleton className="h-4 w-24 mb-2" />
                                        <div className="space-y-1">
                                            <Skeleton className="h-6 w-full" />
                                            <Skeleton className="h-6 w-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-status-error-border bg-status-error-bg p-4 text-center text-sm text-status-error-text">
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

                        {/* ---------- NEW: Stage Summary ---------- */}
                        {session.workflowResult?.outputs?.stageMetrics && session.workflowResult.outputs.stageMetrics.length > 0 && (
                            <div className="mt-3 border-t border-border-subtle pt-2">
                                <h4 className="text-xs font-medium text-text-muted mb-1">Stage Summary</h4>
                                <table className="w-full text-xs text-text-muted">
                                    <thead className="border-b border-border-subtle">
                                        <tr>
                                            <th className="text-left py-1 font-medium text-text-secondary">Stage</th>
                                            <th className="text-right py-1 font-medium text-text-secondary">Findings</th>
                                            <th className="text-right py-1 font-medium text-text-secondary">Claims</th>
                                            <th className="text-right py-1 font-medium text-text-secondary">Verified</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {session.workflowResult.outputs.stageMetrics.map((m) => (
                                            <tr key={m.stageId} className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors">
                                                <td className="py-1">{m.stageLabel}</td>
                                                <td className="text-right py-1 font-mono">{m.findings}</td>
                                                <td className="text-right py-1 font-mono">{m.claims}</td>
                                                <td className="text-right py-1 font-mono">{m.verified}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

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
        COMPLETED: "bg-status-success-bg text-status-success-text border-status-success-border",
        FAILED: "bg-status-error-bg text-status-error-text border-status-error-border",
        RUNNING: "bg-bg-elevated text-text-primary border-border-strong",
        PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
        CANCELLED: "bg-text-muted/10 text-text-secondary border-border-subtle",
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
