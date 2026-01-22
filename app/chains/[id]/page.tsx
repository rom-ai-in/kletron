"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuditChain } from "@/src/services/chainTypes";
import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import { HotspotHeatmap } from "@/src/components/HotspotHeatmap";
import { LLMComparisonTable } from "@/src/components/LLMComparisonTable";
import { ChainBuilderModal } from "@/src/components/ChainBuilderModal";

interface ChainDetailPageProps {
    params: { id: string };
}

export default function ChainDetailPage({ params }: ChainDetailPageProps) {
    const router = useRouter();
    const [chain, setChain] = useState<AuditChain | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        void fetchChain();
    }, [params.id]);

    // Setup SSE for running chains
    useEffect(() => {
        if (!chain || chain.status !== "RUNNING") return;

        const eventSource = new EventSource(`/api/chains/${params.id}/stream`);

        eventSource.onmessage = (event) => {
            const update = JSON.parse(event.data);

            if (update.type === "progress") {
                // Refresh chain data
                void fetchChain();
            }

            if (update.type === "chain_complete") {
                // Close connection and refresh
                eventSource.close();
                void fetchChain();
            }
        };

        eventSource.onerror = () => {
            console.error("SSE connection error");
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [chain?.status]);

    const fetchChain = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/chains/${params.id}`);
            if (!res.ok) throw new Error("Failed to load chain");
            const data = await res.json();
            setChain(data.chain);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        try {
            const res = await fetch(`/api/chains/${params.id}/execute`, {
                method: "PUT",
            });
            if (!res.ok) throw new Error("Failed to start execution");
            await fetchChain();
        } catch (err: any) {
            alert(`Failed to start chain: ${err.message}`);
        }
    };

    const handlePause = async () => {
        try {
            const res = await fetch(`/api/chains/${params.id}/pause`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to pause");
            await fetchChain();
        } catch (err: any) {
            alert(`Failed to pause chain: ${err.message}`);
        }
    };

    const downloadFile = (filename: string, content: string, contentType: string) => {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportJSON = async () => {
        if (!chain) return;
        try {
            const res = await fetch(`/api/chains/${params.id}/report`);
            const data = await res.json();
            downloadFile(`chain-audit-${params.id}.json`, JSON.stringify(data, null, 2), "application/json");
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    const handleExportMarkdown = async () => {
        if (!chain) return;
        try {
            const res = await fetch(`/api/chains/${params.id}/report`);
            const data = await res.json();
            downloadFile(`chain-audit-${params.id}.md`, data.report || "# Audit Report", "text/markdown");
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
            </div>
        );
    }

    if (error || !chain) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4">
                <p className="text-sm text-rose-400">Error: {error || "Chain not found"}</p>
                <Button onClick={() => router.push("/chains")}>Back to Campaigns</Button>
            </div>
        );
    }

    const progress =
        chain.stages.length > 0
            ? ((chain.currentStageIndex / chain.stages.length) * 100).toFixed(0)
            : 0;

    return (
        <div className="flex h-full flex-col">
            <ChainBuilderModal
                open={isEditing}
                onClose={() => setIsEditing(false)}
                onCreated={() => {
                    setIsEditing(false);
                    void fetchChain();
                }}
                editChainId={params.id}
            />
            {/* Header with Breadcrumbs */}
            <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="mb-4 flex items-center gap-2 text-xs font-medium">
                    <button
                        onClick={() => router.push("/")}
                        className="text-text-muted transition hover:text-text-primary"
                    >
                        Home
                    </button>
                    <span className="text-border-strong">/</span>
                    <button
                        onClick={() => router.push("/chains")}
                        className="text-text-muted transition hover:text-text-primary"
                    >
                        Audit Campaigns
                    </button>
                    <span className="text-border-strong">/</span>
                    <span className="text-text-primary">{chain.name}</span>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">{chain.name}</h1>
                        <p className="text-sm text-text-muted">{chain.description}</p>
                    </div>
                    <div className="flex gap-2">
                        {chain.status !== "RUNNING" && (
                            <Button onClick={() => setIsEditing(true)} variant="secondary">
                                Edit Campaign
                            </Button>
                        )}
                        {chain.status === "PENDING" && (
                            <Button onClick={() => void handleExecute()}>Start Campaign</Button>
                        )}
                        {chain.status === "RUNNING" && (
                            <Button onClick={() => void handlePause()} variant="secondary">
                                Pause
                            </Button>
                        )}
                        {chain.status === "COMPLETED" && (
                            <>
                                <Button onClick={() => void handleExportJSON()} variant="secondary" size="sm">
                                    Export JSON
                                </Button>
                                <Button onClick={() => void handleExportMarkdown()} variant="secondary" size="sm">
                                    Export MD
                                </Button>
                                <Button onClick={() => window.print()} variant="primary" size="sm">
                                    Print Report
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            {chain.status === "RUNNING" && (
                <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-text-primary">
                                Stage {chain.currentStageIndex + 1} of {chain.stages.length}
                            </span>
                            <span className="text-text-muted">{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6">
                <div className="space-y-4">
                    {/* Stages */}
                    <Panel className="p-4">
                        <h2 className="mb-4 text-sm font-semibold text-text-primary">Stages</h2>
                        <div className="space-y-3">
                            {chain.stages.map((stage, index) => {
                                const isActive = index === chain.currentStageIndex;
                                const isCompleted = index < chain.currentStageIndex;

                                const statusIcon = isCompleted
                                    ? "✅"
                                    : isActive && chain.status === "RUNNING"
                                        ? "🔄"
                                        : "⏸";

                                return (
                                    <div
                                        key={stage.id}
                                        className={`rounded-lg border p-3 ${isActive
                                            ? "border-sky-500/40 bg-sky-500/5"
                                            : "border-border-subtle bg-bg-surface"
                                            } ${isCompleted ? "opacity-60" : ""}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{statusIcon}</span>
                                            <span className="text-sm font-medium text-text-primary">
                                                {stage.name}
                                            </span>
                                            <span className="text-xs text-text-muted">
                                                Graph: {stage.graphId} | Prompt: {stage.promptPath.split('/').pop()?.replace('.md', '')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>

                    {/* Advanced Visualizations (Completed or with findings) */}
                    {chain.aggregatedFindings.length > 0 && (
                        <>
                            <HotspotHeatmap findings={chain.aggregatedFindings} />
                            {chain.stages.length > 1 && (
                                <LLMComparisonTable
                                    stages={chain.stages}
                                    findings={chain.aggregatedFindings}
                                />
                            )}
                        </>
                    )}

                    {/* Findings */}
                    {chain.aggregatedFindings.length > 0 && (
                        <Panel className="p-4">
                            <h2 className="mb-4 text-sm font-semibold text-text-primary">
                                Findings ({chain.aggregatedFindings.length})
                            </h2>
                            <div className="space-y-2">
                                {chain.aggregatedFindings.slice(0, 10).map((finding, i) => (
                                    <div
                                        key={i}
                                        className="rounded-lg border border-border-subtle bg-bg-surface p-3 text-sm"
                                    >
                                        <div className="flex items-start gap-2">
                                            <span
                                                className={`text-xs font-medium ${finding.type === "BLOQUANT"
                                                    ? "text-rose-400"
                                                    : finding.type === "WARNING"
                                                        ? "text-amber-400"
                                                        : "text-sky-400"
                                                    }`}
                                            >
                                                {finding.type}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-text-primary">{finding.description}</p>
                                                <p className="mt-1 font-mono text-xs text-text-muted">{finding.file}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {chain.aggregatedFindings.length > 10 && (
                                    <p className="text-center text-xs text-text-muted">
                                        + {chain.aggregatedFindings.length - 10} more findings
                                    </p>
                                )}
                            </div>
                        </Panel>
                    )}

                    {/* Insights */}
                    {chain.crossStageInsights.length > 0 && (
                        <Panel className="p-4">
                            <h2 className="mb-4 text-sm font-semibold text-text-primary">
                                Cross-Stage Insights
                            </h2>
                            <div className="space-y-3">
                                {chain.crossStageInsights.map((insight) => (
                                    <div
                                        key={insight.id}
                                        className="rounded-lg border border-border-subtle bg-bg-surface p-3"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="text-sm font-medium text-text-primary">
                                                    {insight.title}
                                                </h3>
                                                <p className="mt-1 text-xs text-text-muted">{insight.description}</p>
                                            </div>
                                            <span
                                                className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${insight.priority === "CRITICAL"
                                                    ? "bg-rose-500/10 text-rose-400"
                                                    : insight.priority === "HIGH"
                                                        ? "bg-amber-500/10 text-amber-400"
                                                        : "bg-sky-500/10 text-sky-400"
                                                    }`}
                                            >
                                                {insight.priority}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    )}

                    {/* Final Report */}
                    {chain.status === "COMPLETED" && chain.finalReport && (
                        <Panel className="p-4">
                            <h2 className="mb-4 text-sm font-semibold text-text-primary">Final Report</h2>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <pre className="whitespace-pre-wrap rounded-lg bg-bg-elevated p-4 text-xs text-text-secondary">
                                    {chain.finalReport}
                                </pre>
                            </div>
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
