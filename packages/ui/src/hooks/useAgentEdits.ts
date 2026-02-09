import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message } from './useAgentStream';
import { normalizeMessage } from './useAgentStream';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PendingEdit {
    id: string;
    conversationId: string;
    toolName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: Record<string, any>;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    description?: string;
}

export interface UseAgentEditsOptions {
    conversationId: string;
    workspaceId?: string;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    isAtBottomRef: React.MutableRefObject<boolean>;
}

export interface UseAgentEditsReturn {
    pendingEdits: PendingEdit[];
    expandedEditId: string | null;
    setExpandedEditId: (id: string | null) => void;
    approvingAll: boolean;
    setApprovingAll: (value: boolean) => void;
    rejectingAll: boolean;
    setRejectingAll: (value: boolean) => void;
    loadData: (options?: { force?: boolean }) => Promise<void>;
    bottomRef: React.RefObject<HTMLDivElement>;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAgentEdits(options: UseAgentEditsOptions): UseAgentEditsReturn {
    const { conversationId, workspaceId, setMessages, isAtBottomRef } = options;

    const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
    const [expandedEditId, setExpandedEditId] = useState<string | null>(null);
    const [approvingAll, setApprovingAll] = useState(false);
    const [rejectingAll, setRejectingAll] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
    const scrollContainerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
    const loadAbortRef = useRef<AbortController | null>(null);
    const loadInFlightRef = useRef(false);

    // ── Scroll helpers ───────────────────────────────────────────────────

    const checkIsAtBottom = useCallback(() => {
        if (!scrollContainerRef.current) return true;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        return scrollHeight - scrollTop - clientHeight < 50;
    }, []);

    const handleScroll = useCallback((_e: React.UIEvent<HTMLDivElement>) => {
        isAtBottomRef.current = checkIsAtBottom();
    }, [isAtBottomRef, checkIsAtBottom]);

    // ── Load messages + edits ────────────────────────────────────────────

    const loadData = useCallback(async (opts?: { force?: boolean }) => {
        if (!conversationId) return;
        if (loadInFlightRef.current) {
            if (!opts?.force) return;
            if (loadAbortRef.current) {
                loadAbortRef.current.abort();
                loadAbortRef.current = null;
            }
        }
        loadInFlightRef.current = true;
        const controller = new AbortController();
        loadAbortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const workspaceQuery = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
            const [res, editsRes] = await Promise.all([
                fetch(`/api/agent/${conversationId}${workspaceQuery}`, {
                    signal: controller.signal,
                    cache: "no-store",
                    credentials: "include",
                }),
                fetch(`/api/agent/edits?conversationId=${conversationId}`, {
                    signal: controller.signal,
                    cache: "no-store",
                    credentials: "include",
                }),
            ]);

            if (res.ok) {
                const data = await res.json();
                const nextMessages = Array.isArray(data.messages) ? data.messages.map(normalizeMessage) : [];
                setMessages(nextMessages);
            }

            if (editsRes.ok) {
                const edits = await editsRes.json();
                setPendingEdits(edits);
            }
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                console.error("Failed to load session data", e);
            }
        } finally {
            clearTimeout(timeoutId);
            if (loadAbortRef.current === controller) {
                loadAbortRef.current = null;
            }
            loadInFlightRef.current = false;
        }
    }, [conversationId, workspaceId, setMessages]);

    // ── Polling ──────────────────────────────────────────────────────────

    useEffect(() => {
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            if (document.visibilityState === "hidden") return;
            void loadData();
        };

        tick();
        const interval = setInterval(tick, 3000);
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                tick();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            if (loadAbortRef.current) {
                loadAbortRef.current.abort();
                loadAbortRef.current = null;
            }
            loadInFlightRef.current = false;
        };
    }, [loadData]);

    // ── Auto-scroll ──────────────────────────────────────────────────────

    useEffect(() => {
        if (isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [pendingEdits, isAtBottomRef]);

    return {
        pendingEdits,
        expandedEditId,
        setExpandedEditId,
        approvingAll,
        setApprovingAll,
        rejectingAll,
        setRejectingAll,
        loadData,
        bottomRef,
        scrollContainerRef,
        handleScroll,
    };
}
