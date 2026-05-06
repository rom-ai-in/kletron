import { useState, useRef, useEffect, useCallback } from 'react';
import { joinApiOrigin } from '@kletron/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionPendingEdit {
    id: string;
    toolName: string;
     
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
    | { kind: "approved_session"; toolName: string }
    | { kind: "rejected"; toolName: string }
    | { kind: "approved_all"; count: number }
    | { kind: "rejected_all"; count: number };

export interface UseSessionEditsOptions {
    /** The session/run ID to fetch edits for. */
    sessionId: string | null;
    /** Whether the session is currently streaming/running. */
    isStreaming: boolean;
    /** When set (e.g. desktop), prepended to `/api/...` paths. */
    apiOrigin?: string;
    /** Extra headers (e.g. Bearer token, x-workspace-id). */
    getRequestHeaders?: () => Promise<Record<string, string>>;
}

export interface UseSessionEditsReturn {
    pendingEdits: SessionPendingEdit[];
    /** Per-row in-flight approve/reject (for accurate button labels). */
    processingOp: { editId: string; op: "approve" | "approve_session" | "reject" } | null;
    /** Short-lived message after the queue changes (esp. when it becomes empty). */
    flushNotice: SessionEditFlushNotice | null;
    dismissFlushNotice: () => void;
    /** Approve a single edit. Pass toolName for accurate toast copy if the list updates mid-request. */
    approveEdit: (editId: string, toolName?: string) => Promise<void>;
    /** Approve a single edit for the full session scope (Codex only). */
    approveEditForSession: (editId: string, toolName?: string) => Promise<void>;
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
    const { sessionId, isStreaming, apiOrigin, getRequestHeaders } = options;

    const getRequestHeadersRef = useRef(getRequestHeaders);
    getRequestHeadersRef.current = getRequestHeaders;

    const [pendingEdits, setPendingEdits] = useState<SessionPendingEdit[]>([]);
    const [processingOp, setProcessingOp] = useState<{
        editId: string;
        op: "approve" | "approve_session" | "reject";
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
            const authExtra = (await getRequestHeadersRef.current?.()) ?? {};
            const res = await fetch(
                joinApiOrigin(apiOrigin, `/api/sessions/${sessionId}/edits`),
                {
                    signal: controller.signal,
                    cache: "no-store",
                    credentials: "include",
                    headers: { ...authExtra },
                },
            );
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
    }, [sessionId, apiOrigin]);

    // Poll for edits while streaming
    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        const tick = () => {
            if (cancelled || document.visibilityState === "hidden") return;
            void fetchEdits();
        };

        tick();
        /** Fast poll while streaming or when approvals are queued (stream may appear idle during human-in-the-loop). */
        const intervalMs = isStreaming || pendingEdits.length > 0 ? 3000 : 10000;
        const interval = setInterval(tick, intervalMs);
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
    }, [sessionId, isStreaming, pendingEdits.length, fetchEdits]);

    const approveEdit = useCallback(
        async (editId: string, toolName?: string) => {
            if (!sessionId) return;
            const name = toolName?.trim() || "tool";
            setProcessingOp({ editId, op: "approve" });
            try {
                const authExtra = (await getRequestHeadersRef.current?.()) ?? {};
                const res = await fetch(
                    joinApiOrigin(apiOrigin, `/api/sessions/${sessionId}/edits/approve`),
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...authExtra },
                        body: JSON.stringify({ editId }),
                    },
                );
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
        [sessionId, apiOrigin, fetchEdits, scheduleFlushNotice]
    );

    const rejectEdit = useCallback(
        async (editId: string, toolName?: string) => {
            if (!sessionId) return;
            const name = toolName?.trim() || "tool";
            setProcessingOp({ editId, op: "reject" });
            try {
                const authExtra = (await getRequestHeadersRef.current?.()) ?? {};
                await fetch(joinApiOrigin(apiOrigin, `/api/sessions/${sessionId}/edits/reject`), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authExtra },
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
        [sessionId, apiOrigin, fetchEdits, scheduleFlushNotice]
    );

    const approveEditForSession = useCallback(
        async (editId: string, toolName?: string) => {
            if (!sessionId) return;
            const name = toolName?.trim() || "tool";
            setProcessingOp({ editId, op: "approve_session" });
            try {
                const authExtra = (await getRequestHeadersRef.current?.()) ?? {};
                const res = await fetch(
                    joinApiOrigin(apiOrigin, `/api/sessions/${sessionId}/edits/approve`),
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...authExtra },
                        body: JSON.stringify({ editId, decision: "acceptForSession" }),
                    },
                );
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(
                        payload?.executionResult?.message ||
                            payload?.error ||
                            "Approval execution failed"
                    );
                }
                await fetchEdits();
                scheduleFlushNotice({ kind: "approved_session", toolName: name });
            } catch (e) {
                console.error("[useSessionEdits] Approve for session failed:", e);
            } finally {
                setProcessingOp((cur) => (cur?.editId === editId ? null : cur));
            }
        },
        [sessionId, apiOrigin, fetchEdits, scheduleFlushNotice]
    );

    const approveAll = useCallback(async () => {
        if (!sessionId) return;
        const count = pendingEdits.length;
        setApprovingAll(true);
        try {
            const authExtra = (await getRequestHeadersRef.current?.()) ?? {};
            const res = await fetch(
                joinApiOrigin(apiOrigin, `/api/sessions/${sessionId}/edits/approve`),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authExtra },
                    body: JSON.stringify({ action: "all" }),
                },
            );
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
    }, [sessionId, apiOrigin, fetchEdits, pendingEdits.length, scheduleFlushNotice]);

    const rejectAll = useCallback(async () => {
        if (!sessionId) return;
        const count = pendingEdits.length;
        setRejectingAll(true);
        try {
            const authExtra = (await getRequestHeadersRef.current?.()) ?? {};
            await fetch(joinApiOrigin(apiOrigin, `/api/sessions/${sessionId}/edits/reject`), {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authExtra },
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
    }, [sessionId, apiOrigin, fetchEdits, pendingEdits.length, scheduleFlushNotice]);

    return {
        pendingEdits,
        processingOp,
        flushNotice,
        dismissFlushNotice,
        approveEdit,
        approveEditForSession,
        rejectEdit,
        approveAll,
        rejectAll,
        approvingAll,
        rejectingAll,
        refreshEdits: fetchEdits,
    };
}
