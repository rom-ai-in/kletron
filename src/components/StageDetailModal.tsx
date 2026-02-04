"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { Modal, Skeleton } from "@/src/components/design-system";
import type { AgentEvent } from "../types";

interface StageDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    stageId: string;
    stageName: string;
    sessionId?: string;
    status: string;
}

export function StageDetailModal({
    isOpen,
    onClose,
    stageId,
    stageName,
    sessionId,
    status
}: StageDetailModalProps) {
    const [events, setEvents] = useState<AgentEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"logs" | "json">("logs");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && sessionId) {
            void fetchSessionDetails();
        } else {
            setEvents([]);
        }
    }, [isOpen, sessionId]);

    const fetchSessionDetails = async () => {
        if (!sessionId) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/audits/${sessionId}`);
            if (!res.ok) throw new Error("Failed to load stage execution details");
            const data = await res.json();

            // Support both new flattened structure and legacy nested structure
            const stream = data.eventStream || data.workflowResult?.eventStream;

            if (Array.isArray(stream)) {
                setEvents(stream);
            }
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!events.length) return;

        const text = activeTab === "json"
            ? JSON.stringify(events, null, 2)
            : events.map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.kind.toUpperCase()} (${e.phaseLabel}): ${e.content || ""}`).join("\n");

        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={stageName}
            subtitle={`Execution Details • ${status}`}
            fullHeight={true}
        >
            <div className="flex h-full flex-col">
                {/* Tabs */}
                <div className="flex items-center border-b border-border-subtle bg-bg-surface px-6 pt-2">
                    <button
                        onClick={() => setActiveTab("logs")}
                        className={`border-b-2 px-4 py-2 text-sm font-medium transition ${activeTab === "logs"
                            ? "border-text-primary text-text-primary"
                            : "border-transparent text-text-muted hover:text-text-primary"
                            }`}
                    >
                        Execution Log
                    </button>
                    <button
                        onClick={() => setActiveTab("json")}
                        className={`border-b-2 px-4 py-2 text-sm font-medium transition ${activeTab === "json"
                            ? "border-text-primary text-text-primary"
                            : "border-transparent text-text-muted hover:text-text-primary"
                            }`}
                    >
                        Raw JSON
                    </button>

                    <button
                        onClick={handleCopy}
                        disabled={events.length === 0}
                        className="ml-auto mb-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Copy to clipboard"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Copy All</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 relative min-h-0 bg-bg-app">
                    {loading && (
                        <div className="absolute inset-0 overflow-hidden p-4 space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                                    <div className="flex items-start gap-3">
                                        <Skeleton className="h-5 w-5 rounded" />
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-2/3" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center p-6">
                            <div className="text-center text-rose-400">Error: {error}</div>
                        </div>
                    )}

                    {!loading && !error && activeTab === "logs" && (
                        <div className="absolute inset-0 overflow-y-auto p-4 scrollbar-elegant">
                            <div className="mx-auto max-w-4xl space-y-4">
                                {events.map((event) => (
                                    <EventLogItem key={event.id} event={event} />
                                ))}
                                {events.length === 0 && (
                                    <p className="text-center text-sm text-text-muted mt-10">No events recorded.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {!loading && !error && activeTab === "json" && (
                        <div className="absolute inset-0 overflow-y-auto p-4 scrollbar-elegant">
                            <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono">
                                {JSON.stringify(events, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function EventLogItem({ event }: { event: AgentEvent }) {
    const isTool = event.kind === "tool";
    const isError = event.phaseLabel === "Error";
    const [expanded, setExpanded] = useState(false);

    // Simplified content display
    const contentPreview = event.content?.slice(0, 150) + (event.content?.length > 150 ? "..." : "");

    return (
        <div className={`rounded-lg border bg-bg-surface p-3 transition ${isError ? "border-rose-500/30 bg-rose-500/5" : "border-border-subtle"}`}>
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded text-[10px] uppercase font-bold ${event.kind === "user" ? "bg-text-primary text-bg-surface" :
                    event.kind === "assistant" ? "bg-emerald-500/10 text-emerald-400" :
                        event.kind === "tool" ? "bg-bg-elevated text-text-muted border border-border-subtle" :
                            "bg-bg-elevated text-text-muted"
                    }`}>
                    {event.kind === "user" ? "U" :
                        event.kind === "assistant" ? "A" :
                            event.kind === "tool" ? "T" : "S"}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text-primary">
                                {event.phaseLabel || event.phaseId}
                            </span>
                            {event.name && (
                                <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                                    {event.name}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-mono text-text-muted">
                            {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                    </div>

                    <div className="mt-1 text-sm text-text-secondary">
                        {isTool ? (
                            <div className="space-y-1">
                                <p className="font-mono text-xs text-text-muted">Tool Logs</p>
                                {event.toolArgs && (
                                    <pre className="max-h-20 overflow-hidden text-[10px] text-text-muted opacity-80">
                                        Input: {event.toolArgs}
                                    </pre>
                                )}
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{expanded ? event.content : contentPreview}</p>
                        )}
                    </div>

                    {isTool && event.content && (
                        <div className="mt-2 text-xs text-text-primary">
                            <div className="font-mono text-[10px] uppercase text-text-muted mb-1">Result</div>
                            <p className={`whitespace-pre-wrap font-mono bg-bg-elevated p-2 rounded ${expanded ? "" : "max-h-24 overflow-hidden"}`}>
                                {event.content}
                            </p>
                        </div>
                    )}

                    {(event.content?.length > 150 || (isTool && event.content?.length > 100)) && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="mt-2 text-[10px] text-text-muted hover:text-text-primary underline"
                        >
                            {expanded ? "Show less" : "Show more"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
