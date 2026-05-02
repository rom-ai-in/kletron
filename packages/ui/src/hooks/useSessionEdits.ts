import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionPendingEdit {
    id: string;
    toolName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: Record<string, any>;
    status: string;
    createdAt?: string;
    description?: string;
    lastError?: string;
    lastAttemptAt?: string;
}

/** Shown briefly after a pending edit is resolved so the panel does not “blink” away with no feedback. */
export type SessionEditFlushNotice =
    | { kind: "approved"; toolName: string }
    | { kind: "rejected"; toolName: string }
    | { kind: "approved_all"; count: number }
    | { kind: "rejected_all"; count: number };

export interface UseSessionEditsOptions {
    /** The session/run ID to fetch edits for. */
    sessionId: string | null;
    /** Whether the session is currently streaming/running. */
    isStreaming: boolean;
}

export interface UseSessionEditsReturn {
    pendingEdits: SessionPendingEdit[];
    /** Per-row in-flight approve/reject (for accurate button labels). */
    processingOp: { editId: string; op: "approve" | "reject" } | null;
    /** Short-lived message after the queue changes (esp. when it becomes empty). */
    flushNotice: SessionEditFlushNotice | null;
    dismissFlushNotice: () => void;
    /** Approve a single edit. Pass toolName for accurate toast copy if the list updates mid-request. */
    approveEdit: (editId: string, toolName?: string) => Promise<void>;
    /** Reject a single edit. */
    rejectEdit: (editId: string, toolName?: string) => Promise<void>;
    /** Approve all pending edits. */
    approveAll: () => Promise<void>;
    /** Reject all pending edits. */
    rejectAll: () => Promise<void>;
    /** Whether a bulk action is in progress. */
    approvingAll: boolean;
    rejectingAll: boolean;
    /** Refresh edits manually. */
    refreshEdits: () => Promise<void>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

const NOTICE_MS = 5000;

export function useSessionEdits(options: UseSessionEditsOptions): UseSessionEditsReturn {
    const { sessionId, isStreaming } = options;

    const [pendingEdits, setPendingEdits] = useState<SessionPendingEdit[]>([]);
    const [processingOp, setProcessingOp] = useState<{
        editId: string;
        op: "approve" | "reject";
    } | null>(null);
    const [flushNotice, setFlushNotice] = useState<SessionEditFlushNotice | null>(null);
    const [approvingAll, setApprovingAll] = useState(false);
    const [rejectingAll, setRejectingAll] = useState(false);
    const pollAbortRef = useRef<AbortController | null>(null);
    const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismissFlushNotice = useCallback(() => {
        if (noticeTimeoutRef.current) {
            clearTimeout(noticeTimeoutRef.current);
            noticeTimeoutRef.current = null;
        }
        setFlushNotice(null);
    }, []);

    const scheduleFlushNotice = useCallback(
        (notice: SessionEditFlushNotice) => {
            if (noticeTimeoutRef.current) {
                clearTimeout(noticeTimeoutRef.current);
            }
            setFlushNotice(notice);
            noticeTimeoutRef.current = setTimeout(() => {
                setFlushNotice(null);
                noticeTimeoutRef.current = null;
            }, NOTICE_MS);
        },
        []
    );

    useEffect(() => {
        return () => {
            if (noticeTimeoutRef.current) {
                clearTimeout(noticeTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        dismissFlushNotice();
        setProcessingOp(null);
    }, [sessionId, dismissFlushNotice]);

    const fetchEdits = useCallback(async () => {
        if (!sessionId) return;
        const controller = new AbortController();
        pollAbortRef.current = controller;
        try {
            const res = await fetch(`/api/sessions/${sessionId}/edits`, {
                signal: controller.signal,
                cache: "no-store",
                credentials: "include",
            });
            if (res.ok) {
                const edits = await res.json();
                setPendingEdits(Array.isArray(edits) ? edits : []);
            }
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                console.error("[useSessionEdits] Failed to fetch edits:", e);
            }
        } finally {
            if (pollAbortRef.current === controller) {
                pollAbortRef.current = null;
            }
        }
    }, [sessionId]);

    // Poll for edits while streaming
    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        const tick = () => {
            if (cancelled || document.visibilityState === "hidden") return;
            void fetchEdits();
        };

        tick();
        const interval = setInterval(tick, isStreaming ? 3000 : 10000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") tick();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
            if (pollAbortRef.current) {
                pollAbortRef.current.abort();
                pollAbortRef.current = null;
            }
        };
    }, [sessionId, isStreaming, fetchEdits]);

    const approveEdit = useCallback(
        async (editId: string, toolName?: string) => {
            if (!sessionId) return;
            const name = toolName?.trim() || "tool";
            setProcessingOp({ editId, op: "approve" });
            try {
                const res = await fetch(`/api/sessions/${sessionId}/edits/approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ editId }),
                });
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(
                        payload?.executionResult?.message ||
                            payload?.error ||
                            "Approval execution failed"
                    );
                }
                await fetchEdits();
                scheduleFlushNotice({ kind: "approved", toolName: name });
            } catch (e) {
                console.error("[useSessionEdits] Approve failed:", e);
            } finally {
                setProcessingOp((cur) => (cur?.editId === editId ? null : cur));
            }
        },
        [sessionId, fetchEdits, scheduleFlushNotice]
    );

    const rejectEdit = useCallback(
        async (editId: string, toolName?: string) => {
            if (!sessionId) return;
            const name = toolName?.trim() || "tool";
            setProcessingOp({ editId, op: "reject" });
            try {
                await fetch(`/api/sessions/${sessionId}/edits/reject`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ editId }),
                });
                await fetchEdits();
                scheduleFlushNotice({ kind: "rejected", toolName: name });
            } catch (e) {
                console.error("[useSessionEdits] Reject failed:", e);
            } finally {
                setProcessingOp((cur) => (cur?.editId === editId ? null : cur));
            }
        },
        [sessionId, fetchEdits, scheduleFlushNotice]
    );

    const approveAll = useCallback(async () => {
        if (!sessionId) return;
        const count = pendingEdits.length;
        setApprovingAll(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/edits/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "all" }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || "Bulk approval execution failed");
            }
            await fetchEdits();
            if (count > 0) {
                scheduleFlushNotice({ kind: "approved_all", count });
            }
        } catch (e) {
            console.error("[useSessionEdits] Approve all failed:", e);
        } finally {
            setApprovingAll(false);
        }
    }, [sessionId, fetchEdits, pendingEdits.length, scheduleFlushNotice]);

    const rejectAll = useCallback(async () => {
        if (!sessionId) return;
        const count = pendingEdits.length;
        setRejectingAll(true);
        try {
            await fetch(`/api/sessions/${sessionId}/edits/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "all" }),
            });
            await fetchEdits();
            if (count > 0) {
                scheduleFlushNotice({ kind: "rejected_all", count });
            }
        } catch (e) {
            console.error("[useSessionEdits] Reject all failed:", e);
        } finally {
            setRejectingAll(false);
        }
    }, [sessionId, fetchEdits, pendingEdits.length, scheduleFlushNotice]);

    return {
        pendingEdits,
        processingOp,
        flushNotice,
        dismissFlushNotice,
        approveEdit,
        rejectEdit,
        approveAll,
        rejectAll,
        approvingAll,
        rejectingAll,
        refreshEdits: fetchEdits,
    };
}
