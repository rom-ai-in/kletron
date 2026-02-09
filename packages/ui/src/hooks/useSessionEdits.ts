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
}

export interface UseSessionEditsOptions {
    /** The session/run ID to fetch edits for. */
    sessionId: string | null;
    /** Whether the session is currently streaming/running. */
    isStreaming: boolean;
}

export interface UseSessionEditsReturn {
    pendingEdits: SessionPendingEdit[];
    /** Approve a single edit. */
    approveEdit: (editId: string) => Promise<void>;
    /** Reject a single edit. */
    rejectEdit: (editId: string) => Promise<void>;
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

export function useSessionEdits(options: UseSessionEditsOptions): UseSessionEditsReturn {
    const { sessionId, isStreaming } = options;

    const [pendingEdits, setPendingEdits] = useState<SessionPendingEdit[]>([]);
    const [approvingAll, setApprovingAll] = useState(false);
    const [rejectingAll, setRejectingAll] = useState(false);
    const pollAbortRef = useRef<AbortController | null>(null);

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

    const approveEdit = useCallback(async (editId: string) => {
        if (!sessionId) return;
        try {
            await fetch(`/api/sessions/${sessionId}/edits/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ editId }),
            });
            await fetchEdits();
        } catch (e) {
            console.error("[useSessionEdits] Approve failed:", e);
        }
    }, [sessionId, fetchEdits]);

    const rejectEdit = useCallback(async (editId: string) => {
        if (!sessionId) return;
        try {
            await fetch(`/api/sessions/${sessionId}/edits/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ editId }),
            });
            await fetchEdits();
        } catch (e) {
            console.error("[useSessionEdits] Reject failed:", e);
        }
    }, [sessionId, fetchEdits]);

    const approveAll = useCallback(async () => {
        if (!sessionId) return;
        setApprovingAll(true);
        try {
            await fetch(`/api/sessions/${sessionId}/edits/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "all" }),
            });
            await fetchEdits();
        } catch (e) {
            console.error("[useSessionEdits] Approve all failed:", e);
        } finally {
            setApprovingAll(false);
        }
    }, [sessionId, fetchEdits]);

    const rejectAll = useCallback(async () => {
        if (!sessionId) return;
        setRejectingAll(true);
        try {
            await fetch(`/api/sessions/${sessionId}/edits/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "all" }),
            });
            await fetchEdits();
        } catch (e) {
            console.error("[useSessionEdits] Reject all failed:", e);
        } finally {
            setRejectingAll(false);
        }
    }, [sessionId, fetchEdits]);

    return {
        pendingEdits,
        approveEdit,
        rejectEdit,
        approveAll,
        rejectAll,
        approvingAll,
        rejectingAll,
        refreshEdits: fetchEdits,
    };
}
