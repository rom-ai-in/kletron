import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { SessionEditFlushNotice, SessionPendingEdit } from "../../hooks/useSessionEdits";

export type PendingSessionEditsStripProps = {
    pendingEdits: SessionPendingEdit[];
    flushNotice: SessionEditFlushNotice | null;
    dismissFlushNotice: () => void;
    processingOp: { editId: string; op: "approve" | "reject" } | null;
    approvingAll: boolean;
    rejectingAll: boolean;
    approveEdit: (editId: string, toolName?: string) => void | Promise<void>;
    rejectEdit: (editId: string, toolName?: string) => void | Promise<void>;
    approveAll: () => void | Promise<void>;
    rejectAll: () => void | Promise<void>;
    /** Extra classes on the outer shell (border strip). */
    className?: string;
    /** Wrapper around content (width constraint). */
    innerClassName?: string;
};

/**
 * Lists pending tool approvals for the active session with approve / reject actions.
 * Matches the web Agent “Pending actions” strip so desktop and browser stay consistent.
 */
export function PendingSessionEditsStrip({
    pendingEdits,
    flushNotice,
    dismissFlushNotice,
    processingOp,
    approvingAll,
    rejectingAll,
    approveEdit,
    rejectEdit,
    approveAll,
    rejectAll,
    className = "",
    innerClassName = "mx-auto w-full max-w-3xl px-2 py-3",
}: PendingSessionEditsStripProps) {
    const showStrip = pendingEdits.length > 0 || flushNotice !== null;
    if (!showStrip) return null;

    return (
        <div className={`flex-none border-t border-white/[0.06] bg-transparent ${className}`.trim()}>
            <div className={innerClassName}>
                {flushNotice ? (
                    <div
                        className={`mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${
                            flushNotice.kind === "rejected" || flushNotice.kind === "rejected_all"
                                ? "border-status-error-border bg-status-error-bg/30 text-status-error-text"
                                : "border-status-success-border bg-status-success-bg/30 text-status-success-text"
                        }`}
                    >
                        {flushNotice.kind === "rejected" || flushNotice.kind === "rejected_all" ? (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
                        ) : (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
                        )}
                        <p className="min-w-0 flex-1 leading-snug">
                            {flushNotice.kind === "approved" && (
                                <>
                                    Approved <span className="font-mono">{flushNotice.toolName}</span>. The run continues in
                                    the thread above.
                                </>
                            )}
                            {flushNotice.kind === "rejected" && (
                                <>
                                    Rejected <span className="font-mono">{flushNotice.toolName}</span>.
                                </>
                            )}
                            {flushNotice.kind === "approved_all" && (
                                <>
                                    Approved {flushNotice.count} pending action{flushNotice.count === 1 ? "" : "s"}. The
                                    run continues in the thread above.
                                </>
                            )}
                            {flushNotice.kind === "rejected_all" && (
                                <>
                                    Rejected {flushNotice.count} pending action{flushNotice.count === 1 ? "" : "s"}.
                                </>
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={() => dismissFlushNotice()}
                            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
                        >
                            Dismiss
                        </button>
                    </div>
                ) : null}

                {pendingEdits.length > 0 ? (
                    <>
                        <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
                            <h3 className="min-w-0 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                                Pending actions ({pendingEdits.length})
                            </h3>
                            <div className="flex flex-shrink-0 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => void approveAll()}
                                    disabled={approvingAll || rejectingAll}
                                    className="rounded border border-status-success-border bg-status-success-bg px-2 py-1 text-[10px] text-status-success-text hover:opacity-80 disabled:opacity-50"
                                >
                                    {approvingAll ? "Approving..." : "Approve All"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void rejectAll()}
                                    disabled={approvingAll || rejectingAll}
                                    className="rounded border border-status-error-border bg-status-error-bg px-2 py-1 text-[10px] text-status-error-text hover:opacity-80 disabled:opacity-50"
                                >
                                    {rejectingAll ? "Rejecting..." : "Reject All"}
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[min(50vh,22rem)] space-y-1 overflow-y-auto overscroll-contain">
                            {pendingEdits.map((edit) => {
                                const busy = processingOp?.editId === edit.id;
                                const approvingThis = busy && processingOp?.op === "approve";
                                const rejectingThis = busy && processingOp?.op === "reject";
                                const desc = edit.description?.trim();
                                const title = [edit.toolName, desc, edit.lastError].filter(Boolean).join(" · ");
                                return (
                                    <div
                                        key={edit.id}
                                        className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-bg-elevated px-2 py-1 text-[10px] leading-none"
                                    >
                                        <p className="min-w-0 flex-1 truncate text-text-primary" title={title}>
                                            <span className="font-mono text-text-primary">{edit.toolName}</span>
                                            {desc ? <span className="text-text-muted"> · {desc}</span> : null}
                                            {edit.lastError ? (
                                                <span className="text-status-error-text"> · {edit.lastError}</span>
                                            ) : null}
                                        </p>
                                        <div className="flex shrink-0 items-center gap-0.5">
                                            <button
                                                type="button"
                                                onClick={() => void approveEdit(edit.id, edit.toolName)}
                                                disabled={busy || approvingAll || rejectingAll}
                                                className="inline-flex items-center gap-0.5 rounded border border-status-success-border bg-status-success-bg px-1.5 py-0.5 text-[9px] text-status-success-text hover:opacity-80 disabled:opacity-50"
                                            >
                                                {approvingThis ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                                        <span>Approving…</span>
                                                    </>
                                                ) : (
                                                    "Approve"
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void rejectEdit(edit.id, edit.toolName)}
                                                disabled={busy || approvingAll || rejectingAll}
                                                className="inline-flex items-center gap-0.5 rounded border border-status-error-border bg-status-error-bg px-1.5 py-0.5 text-[9px] text-status-error-text hover:opacity-80 disabled:opacity-50"
                                            >
                                                {rejectingThis ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                                        <span>Rejecting…</span>
                                                    </>
                                                ) : (
                                                    "Reject"
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
