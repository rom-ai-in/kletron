"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuditChain } from "@/src/services/chainTypes";
import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import { ChainBuilderModal } from "@/src/components/ChainBuilderModal";
import { useBreadcrumbLabelOverride } from "@/src/components/ui/BreadcrumbOverridesProvider";

interface ChainDetailPageProps {
    params: { id: string };
}

export default function ChainDetailPage({ params }: ChainDetailPageProps) {
    const router = useRouter();
    const [chain, setChain] = useState<AuditChain | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    // Dynamic breadcrumb label: replace "Campaign <id>" with the fetched campaign name.
    useBreadcrumbLabelOverride(`/campaigns/${params.id}`, chain?.name);

    useEffect(() => {
        void fetchChain();
    }, [params.id]);

    const fetchChain = async () => {
        setLoading(true);
        setError("");
        try {
            const chainRes = await fetch(`/api/campaigns/${params.id}`);

            if (!chainRes.ok) throw new Error("Failed to load campaign");
            const chainData = await chainRes.json();
            setChain(chainData.chain);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        try {
            const res = await fetch(`/api/campaigns/${params.id}/execute`, {
                method: "PUT",
            });
            if (!res.ok) throw new Error("Failed to start execution");
            const data = (await res.json()) as { status?: string; runId?: string };
            if (!data.runId) throw new Error("Execution started but no runId was returned");
            router.push(`/runs/${data.runId}`);
        } catch (err: any) {
            alert(`Failed to start chain: ${err.message}`);
        }
    };

    const handlePause = async () => {
        try {
            const res = await fetch(`/api/campaigns/${params.id}/pause`, {
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
            const res = await fetch(`/api/campaigns/${params.id}/report`);
            const data = await res.json();
            downloadFile(`chain-audit-${params.id}.json`, JSON.stringify(data, null, 2), "application/json");
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    const handleExportMarkdown = async () => {
        if (!chain) return;
        try {
            const res = await fetch(`/api/campaigns/${params.id}/report`);
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
                <Button onClick={() => router.push("/campaigns")}>Back to Campaigns</Button>
            </div>
        );
    }

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
            <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">{chain.name}</h1>
                        <p className="text-sm text-text-muted">{chain.description}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => router.push(`/history?type=campaign&campaignId=${params.id}`)} variant="secondary">
                            View Runs
                        </Button>
                        {chain.status !== "RUNNING" && (
                            <Button onClick={() => setIsEditing(true)} variant="secondary">
                                Edit Campaign
                            </Button>
                        )}
                        {chain.status === "PENDING" && (
                            <Button onClick={() => void handleExecute()}>Start Campaign</Button>
                        )}
                        {(chain.status === "COMPLETED" || chain.status === "FAILED") && (
                            <Button onClick={() => void handleExecute()} variant="primary">
                                Run Again
                            </Button>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6">
                <div className="space-y-4">
                    <Panel className="p-4">
                        <h2 className="mb-4 text-sm font-semibold text-text-primary">Stages</h2>
                        <div className="space-y-3">
                            {chain.stages.map((stage) => (
                                <div
                                    key={stage.id}
                                    className="w-full text-left rounded-lg border border-border-subtle bg-bg-surface p-3"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-text-primary truncate">
                                                {stage.name}
                                            </div>
                                            <div className="text-xs text-text-muted truncate">
                                                Graph: {stage.graphId} · Prompt: {stage.promptPath.split("/").pop()?.replace(".md", "")}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle">
                                            Config
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 text-xs text-text-muted">
                            Execution logs, findings, and reports live under <span className="text-text-secondary">Runs</span>.
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
