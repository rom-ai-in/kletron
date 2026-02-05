"use client";

import { useState, useEffect } from "react";
import { Modal, Skeleton } from "@numezis/ui/components/design-system";
import { StageDetailModal } from "./StageDetailModal";
import { CheckCircle2, AlertCircle, Clock, PlayCircle, ChevronRight, GitBranch, Copy, Check, Loader2 } from "lucide-react";
import type { AgentEvent } from "@numezis/shared/types";

interface AgentGraphRunModalProps {
    isOpen: boolean;
    onClose: () => void;
    runId: string;
    graphName: string;
    status: string;
    metadata?: {
        nodeCount: number;
        completedNodes: number;
        failedNodes: number;
        nodeSessionIds?: Record<string, string>;
        nodeStatuses?: Record<string, string>;
        nodeOrder?: string[];
        totalTokens?: number;
        nodeTokenUsage?: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>;
    };
}

/** Format token count to human readable string */
function formatTokenCount(count: number): string {
    if (count < 1000) return String(count);
    if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
    return `${Math.round(count / 1000)}k`;
}

interface NodeInfo {
    id: string;
    label: string;
    sessionId?: string;
    status?: string;
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export function AgentGraphRunModal({
    isOpen,
    onClose,
    runId,
    graphName,
    status,
    metadata
}: AgentGraphRunModalProps) {
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && metadata) {
            buildNodeList();
        } else {
            setNodes([]);
        }
    }, [isOpen, metadata]);

    const handleCopyAllLogs = async () => {
        if (!metadata || !nodes.length) return;

        setCopying(true);
        setCopied(false);

        try {
            const nodeSessionIds = metadata.nodeSessionIds || {};
            const allLogs: string[] = [];

            // Fetch logs for each node in order
            for (const node of nodes) {
                if (!node.sessionId) continue;

                try {
                    const res = await fetch(`/api/audits/${node.sessionId}`);
                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error(`[CopyAllLogs] Failed to fetch session ${node.sessionId}:`, res.status, errorText);
                        allLogs.push(`\n[ERROR] Failed to fetch logs for node: ${node.label} (${res.status})\n`);
                        continue;
                    }

                    const data = await res.json();
                    const stream: AgentEvent[] = data.eventStream || data.workflowResult?.eventStream || [];

                    // Always add node header, even if no events (to show which nodes were processed)
                    allLogs.push(`\n${"=".repeat(60)}`);
                    allLogs.push(`NODE: ${node.label} (${node.id})`);
                    allLogs.push(`STATUS: ${node.status || "UNKNOWN"}`);
                    allLogs.push(`SESSION: ${node.sessionId}`);
                    allLogs.push(`${"=".repeat(60)}\n`);

                    if (stream.length > 0) {
                        for (const event of stream) {
                            const timestamp = new Date(event.timestamp).toLocaleTimeString();
                            const kind = event.kind?.toUpperCase() || "EVENT";
                            const phase = event.phaseLabel || event.phaseId || "";
                            const name = event.name ? ` [${event.name}]` : "";
                            let content = event.content || "";

                            // For tool results, truncate verbose outputs (web searches, fetches, etc.)
                            if (kind === "TOOL" && content) {
                                // Skip binary/PDF content entirely
                                if (content.includes("%PDF-") || content.match(/^[\x00-\x08\x0E-\x1F]/)) {
                                    content = "[Binary/PDF content - skipped]";
                                } else {
                                    // Try to extract just the key info for JSON tool results
                                    try {
                                        const parsed = JSON.parse(content);
                                        if (parsed.query) {
                                            // Web search result - just show query
                                            content = `Query: "${parsed.query}" → ${parsed.results?.length || 0} results`;
                                        } else if (parsed.url && parsed.status !== undefined) {
                                            // Fetch result - just show URL and status
                                            content = `URL: ${parsed.url} → ${parsed.ok ? "OK" : "Failed"} (${parsed.status})`;
                                        } else if (parsed.filePath || parsed.path) {
                                            // File operation
                                            content = `File: ${parsed.filePath || parsed.path}`;
                                        } else {
                                            // Other JSON - truncate
                                            content = content.length > 200 ? content.substring(0, 200) + "..." : content;
                                        }
                                    } catch {
                                        // Not JSON - truncate if too long
                                        content = content.length > 200 ? content.substring(0, 200) + "..." : content;
                                    }
                                }
                            }

                            allLogs.push(`[${timestamp}] ${kind}${name} (${phase}): ${content}`);
                        }
                    } else {
                        allLogs.push(`(No events recorded for this node)`);
                    }
                } catch (err) {
                    console.error(`[CopyAllLogs] Exception for node ${node.label}:`, err);
                    allLogs.push(`\n[ERROR] Failed to fetch logs for node: ${node.label}\n`);
                }
            }

            if (allLogs.length === 0) {
                allLogs.push("No logs found for any nodes.");
            } else {
                // Add header
                allLogs.unshift(`Agent Graph Run: ${graphName}`);
                allLogs.unshift(`Run ID: ${runId}`);
                allLogs.unshift(`Status: ${status}`);
                allLogs.unshift(`Generated: ${new Date().toISOString()}`);
                allLogs.unshift(`${"=".repeat(60)}`);
            }

            await navigator.clipboard.writeText(allLogs.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy logs:", err);
        } finally {
            setCopying(false);
        }
    };

    const buildNodeList = async () => {
        if (!metadata) return;
        setLoading(true);
        setError("");

        try {
            // Build nodes from metadata
            const nodeOrder = metadata.nodeOrder || [];
            const nodeSessionIds = metadata.nodeSessionIds || {};
            const nodeStatuses = metadata.nodeStatuses || {};

            // Fetch session prompts to get node labels
            const sessionIds = Object.values(nodeSessionIds).filter(Boolean);
            let labelMap: Record<string, string> = {};

            if (sessionIds.length > 0) {
                // Try to fetch session details to get labels
                const res = await fetch(`/api/agent-graph-runs/${runId}/nodes`);
                if (res.ok) {
                    const data = await res.json();
                    labelMap = data.labelMap || {};
                }
            }

            const nodeList: NodeInfo[] = nodeOrder.map((nodeId) => ({
                id: nodeId,
                label: labelMap[nodeId] || nodeId,
                sessionId: nodeSessionIds[nodeId],
                status: nodeStatuses[nodeId],
                tokenUsage: metadata.nodeTokenUsage?.[nodeId],
            }));

            setNodes(nodeList);
        } catch (err: any) {
            setError(err.message || "Failed to load nodes");
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (nodeStatus?: string) => {
        switch (nodeStatus) {
            case "COMPLETED":
                return "text-emerald-400 bg-emerald-500/10";
            case "FAILED":
                return "text-rose-400 bg-rose-500/10";
            case "RUNNING":
                return "text-emerald-400 bg-emerald-500/10";
            default:
                return "text-text-muted bg-bg-elevated";
        }
    };

    const getStatusIcon = (nodeStatus?: string) => {
        switch (nodeStatus) {
            case "COMPLETED":
                return <CheckCircle2 className="h-4 w-4" />;
            case "FAILED":
                return <AlertCircle className="h-4 w-4" />;
            case "RUNNING":
                return <PlayCircle className="h-4 w-4" />;
            default:
                return <Clock className="h-4 w-4" />;
        }
    };

    return (
        <>
            <Modal
                open={isOpen && !selectedNode}
                onClose={onClose}
                title={graphName}
                subtitle={`Agent Graph Run • ${status}`}
                fullHeight={true}
            >
                <div className="flex h-full flex-col">
                    {/* Summary Header */}
                    <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <GitBranch className="h-5 w-5 text-text-muted" />
                                    <span className="text-sm text-text-muted">Run ID:</span>
                                    <code className="text-xs font-mono text-text-secondary bg-bg-elevated px-2 py-0.5 rounded">
                                        {runId.slice(0, 8)}...{runId.slice(-4)}
                                    </code>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-text-primary">{metadata?.nodeCount || 0}</div>
                                        <div className="text-xs text-text-muted">Nodes</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-emerald-400">{metadata?.completedNodes || 0}</div>
                                        <div className="text-xs text-text-muted">Completed</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-rose-400">{metadata?.failedNodes || 0}</div>
                                        <div className="text-xs text-text-muted">Failed</div>
                                    </div>
                                    {metadata?.totalTokens && metadata.totalTokens > 0 && (
                                        <div className="text-center">
                                            <div className="text-lg font-semibold text-emerald-400">
                                                {formatTokenCount(metadata.totalTokens)}
                                            </div>
                                            <div className="text-xs text-text-muted">Tokens</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Copy All Logs Button */}
                            <button
                                onClick={handleCopyAllLogs}
                                disabled={copying || nodes.length === 0}
                                className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Copy all logs from all nodes to clipboard"
                            >
                                {copying ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : copied ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                                {copying ? "Copying..." : copied ? "Copied!" : "Copy All Logs"}
                            </button>
                        </div>
                    </div>

                    {/* Node List */}
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-elegant">
                        {loading && (
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-48" />
                                                <Skeleton className="h-3 w-32" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
                                Error: {error}
                            </div>
                        )}

                        {!loading && !error && nodes.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <GitBranch className="mb-4 h-10 w-10 text-text-muted opacity-20" />
                                <p className="text-sm text-text-muted">No node executions found.</p>
                            </div>
                        )}

                        {!loading && !error && nodes.length > 0 && (
                            <div className="space-y-2">
                                {nodes.map((node, index) => (
                                    <button
                                        key={node.id}
                                        onClick={() => node.sessionId && setSelectedNode(node)}
                                        disabled={!node.sessionId}
                                        className={`w-full group rounded-lg border border-border-subtle bg-bg-surface p-4 text-left transition hover:border-border-strong hover:bg-state-hover ${!node.sessionId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Step number */}
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-xs font-mono text-text-muted">
                                                {index + 1}
                                            </div>

                                            {/* Node info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-text-primary truncate">
                                                        {node.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="text-[10px] font-mono text-text-muted">
                                                        {node.id}
                                                    </code>
                                                    {node.sessionId && (
                                                        <span className="text-[10px] text-text-muted">
                                                            • Session: {node.sessionId.slice(0, 8)}...
                                                        </span>
                                                    )}
                                                    {node.tokenUsage && node.tokenUsage.totalTokens > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                                                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {formatTokenCount(node.tokenUsage.totalTokens)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status badge */}
                                            <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(node.status)}`}>
                                                {node.status === "RUNNING" ? (
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                                                    </span>
                                                ) : (
                                                    getStatusIcon(node.status)
                                                )}
                                                {node.status || "PENDING"}
                                            </div>

                                            {/* Arrow */}
                                            {node.sessionId && (
                                                <ChevronRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Node Detail Modal */}
            {selectedNode && (
                <StageDetailModal
                    isOpen={!!selectedNode}
                    onClose={() => setSelectedNode(null)}
                    stageId={selectedNode.id}
                    stageName={selectedNode.label}
                    sessionId={selectedNode.sessionId}
                    status={selectedNode.status || "UNKNOWN"}
                />
            )}
        </>
    );
}
