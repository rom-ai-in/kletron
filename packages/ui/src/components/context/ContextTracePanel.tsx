"use client";

import { useState } from "react";
import { Search, Calculator, Zap, FileText, Hash, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@kletron/ui/components/design-system";
import { RankedContextItem } from "@kletron/shared/context/graph/ContextGraphTypes";

export function ContextTracePanel() {
    const [prompt, setPrompt] = useState("");
    const [results, setResults] = useState<RankedContextItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [totalNodes, setTotalNodes] = useState<number | null>(null);

    const handleTrace = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/context/graph", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, limit: 10 }),
            });
            const data = await res.json();

            if (data.error) {
                setMessage(data.error);
                setResults([]);
            } else if (data.message) {
                setMessage(data.message);
                setResults([]);
            } else if (data.ranked) {
                setResults(data.ranked);
                setTotalNodes(data.totalNodes || null);
                if (data.ranked.length === 0) {
                    setMessage("No relevant context found for this prompt. Try mentioning specific file names.");
                }
            }
        } catch (e) {
            console.error(e);
            setMessage("Failed to connect to context API");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-bg-surface text-text-primary">
            {/* Header */}
            <div className="p-4 border-b border-border-subtle bg-bg-elevated/50">
                <div className="flex items-center gap-2 mb-1">
                    <Calculator className="w-4 h-4 text-primary-main" />
                    <h3 className="text-sm font-semibold">Relevance Trace</h3>
                </div>
                <p className="text-[10px] text-text-muted">
                    Simulate how the agent ranks context nodes.
                </p>
            </div>

            {/* Input */}
            <div className="p-4 border-b border-border-subtle space-y-3">
                <div className="relative">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                        className="w-full text-xs p-2.5 pl-9 bg-bg-elevated border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary-main/50 focus:border-primary-main/50 transition-all"
                        placeholder="Enter hypothetical user prompt..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleTrace()}
                    />
                </div>
                <Button
                    size="sm"
                    onClick={handleTrace}
                    disabled={loading || !prompt.trim()}
                    className="w-full justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Zap size={12} className="animate-pulse" />
                            Calculating...
                        </>
                    ) : (
                        <>
                            <Zap size={12} />
                            Trace Relevance
                        </>
                    )}
                </Button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-elegant bg-bg-app/50">
                {/* Message Display */}
                {message && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-status-warning-bg border border-status-warning-border text-status-warning-text text-xs">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{message}</span>
                    </div>
                )}

                {results.length === 0 && !loading && !message && (
                    <div className="flex flex-col items-center justify-center h-32 text-text-muted text-xs gap-2">
                        <ArrowRight size={20} className="opacity-30" />
                        <span>Enter a prompt and trace to see results.</span>
                        {totalNodes !== null && (
                            <span className="text-[10px]">({totalNodes} nodes in graph)</span>
                        )}
                    </div>
                )}

                {results.map((item, idx) => (
                    <div
                        key={idx}
                        className="bg-bg-elevated p-3 rounded-lg border border-border-subtle hover:border-border-strong transition-colors"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1 rounded bg-status-info-bg text-status-info-text shrink-0">
                                    {item.type === "symbol" ? <Hash size={12} /> : <FileText size={12} />}
                                </div>
                                <span
                                    className="text-xs font-semibold truncate max-w-[180px] text-text-primary"
                                    title={item.id}
                                >
                                    {item.label.split("/").pop()}
                                </span>
                            </div>
                            <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${item.score >= 0.7
                                    ? "bg-status-success-bg text-status-success-text"
                                    : item.score >= 0.4
                                        ? "bg-status-warning-bg text-status-warning-text"
                                        : "bg-bg-elevated text-text-muted"
                                    }`}
                            >
                                {(item.score * 100).toFixed(0)}%
                            </span>
                        </div>

                        {/* Full Path */}
                        <p className="text-[10px] text-text-muted font-mono truncate mb-2" title={item.label}>
                            {item.label}
                        </p>

                        {/* Reasons */}
                        <div className="flex flex-wrap gap-1">
                            {item.reasons.map((r, i) => (
                                <span
                                    key={i}
                                    className="text-[9px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded border border-border-subtle"
                                >
                                    {r}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            {results.length > 0 && (
                <div className="px-4 py-2 border-t border-border-subtle text-[10px] text-text-muted bg-bg-elevated/30">
                    Showing top {results.length} results
                </div>
            )}
        </div>
    );
}
