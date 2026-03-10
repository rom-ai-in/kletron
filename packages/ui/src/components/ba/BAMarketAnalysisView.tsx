"use client";

import { useEffect, useState, useCallback } from "react";
import {
    TrendingUp,
    Target,
    AlertTriangle,
    Lightbulb,
    Zap,
    RefreshCw,
    BarChart3,
    Swords,
} from "lucide-react";
import { Panel, Button, Badge } from "@numezis/ui/components/design-system";
import type { MarketAnalysis, CompetitiveMatrixEntry, CompetitiveStatus } from "@numezis/shared/businessAnalystTypes";
import { useWorkspace } from "@numezis/ui/context/WorkspaceContext";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchMarketAnalysis(workspaceId?: string | null): Promise<MarketAnalysis | null> {
    const params = new URLSearchParams();
    if (workspaceId) {
        params.set("workspaceId", workspaceId);
    }
    const res = await fetch(`/api/business-analyst/market-analysis?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch market analysis");
    const data = await res.json();
    return data.analysis;
}

async function triggerAnalysis(workspaceId?: string | null): Promise<string | null> {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (workspaceId) {
        (headers as any)["x-workspace-id"] = workspaceId;
    }
    const res = await fetch("/api/business-analyst/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ preset: "COMPETITIVE_DEEP_DIVE", ...(workspaceId ? { workspaceId } : {}) }),
    });
    if (!res.ok) return null;
    return (await res.json()).automationId;
}

// ---------------------------------------------------------------------------
// Competitive Status Badge
// ---------------------------------------------------------------------------

const statusColors: Record<CompetitiveStatus, string> = {
    absent: "error",
    basic: "warning",
    good: "info",
    excellent: "success",
};

function StatusBadge({ status }: { status: CompetitiveStatus }) {
    return (
        <Badge size="xs" variant={statusColors[status] as any}>
            {status}
        </Badge>
    );
}

// ---------------------------------------------------------------------------
// Competitive Matrix Table
// ---------------------------------------------------------------------------

function CompetitiveMatrix({ matrix }: { matrix: CompetitiveMatrixEntry[] }) {
    if (!matrix.length) return null;

    // Collect all competitor names
    const competitorNames = new Set<string>();
    for (const entry of matrix) {
        for (const name of Object.keys(entry.competitors)) {
            competitorNames.add(name);
        }
    }
    const competitors = Array.from(competitorNames);

    return (
        <div className="border border-border-subtle rounded-lg overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="bg-bg-elevated border-b border-border-subtle">
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                            Feature Area
                        </th>
                        <th className="text-center px-3 py-2 text-[11px] font-semibold text-text-primary uppercase tracking-wider">
                            Us
                        </th>
                        {competitors.map((name) => (
                            <th key={name} className="text-center px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                {name}
                            </th>
                        ))}
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                            Opportunity
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {matrix.map((entry, i) => (
                        <tr key={i} className="border-b border-border-subtle hover:bg-state-hover transition-colors">
                            <td className="px-3 py-2">
                                <p className="text-sm font-medium text-text-primary">{entry.featureArea}</p>
                                {entry.gap && (
                                    <p className="text-[11px] text-text-muted mt-0.5">Gap: {entry.gap}</p>
                                )}
                            </td>
                            <td className="px-3 py-2 text-center">
                                <StatusBadge status={entry.ourStatus} />
                            </td>
                            {competitors.map((name) => (
                                <td key={name} className="px-3 py-2 text-center">
                                    <StatusBadge status={entry.competitors[name] ?? "absent"} />
                                </td>
                            ))}
                            <td className="px-3 py-2">
                                <p className="text-xs text-text-secondary">{entry.opportunity ?? "-"}</p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BAMarketAnalysisView() {
    const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const { activeWorkspaceId } = useWorkspace();

    const load = useCallback(async () => {
        try {
            const data = await fetchMarketAnalysis(activeWorkspaceId);
            setAnalysis(data);
        } catch (e) {
            console.error("Failed to load market analysis:", e);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspaceId]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const automationId = await triggerAnalysis(activeWorkspaceId);
            if (automationId) {
                window.location.href = `/app/automations/${automationId}`;
            }
        } catch (e) {
            console.error("Failed to trigger analysis:", e);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Market Analysis</h1>
                        <p className="text-sm text-text-muted">
                            {analysis
                                ? `Generated ${new Date(analysis.createdAt).toLocaleDateString()} at ${new Date(analysis.createdAt).toLocaleTimeString()}`
                                : "Competitive intelligence and market insights"
                            }
                        </p>
                    </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleRefresh} disabled={refreshing || loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Starting..." : analysis ? "Refresh Analysis" : "Run Competitive Deep Dive"}
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-sm text-text-muted animate-pulse">Loading market analysis...</div>
                    </div>
                ) : !analysis ? (
                    <Panel className="p-12 border border-border-subtle text-center">
                        <BarChart3 className="h-8 w-8 text-text-muted mx-auto mb-3" />
                        <h3 className="text-base font-semibold text-text-primary mb-1">No Market Analysis Yet</h3>
                        <p className="text-sm text-text-muted mb-4">
                            Run a Competitive Deep Dive to generate your first market analysis with competitive matrix.
                        </p>
                        <Button onClick={handleRefresh} disabled={refreshing}>
                            <Swords className="h-4 w-4 mr-2" />
                            {refreshing ? "Starting..." : "Run Competitive Deep Dive"}
                        </Button>
                    </Panel>
                ) : (
                <div className="space-y-8">
            {/* Market Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.marketSize && (
                    <Panel className="p-4 border border-border-subtle">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="h-4 w-4 text-text-muted" />
                            <h4 className="text-sm font-semibold text-text-primary">Market Size</h4>
                        </div>
                        <p className="text-sm text-text-secondary">{analysis.marketSize}</p>
                    </Panel>
                )}
                {analysis.growthTrend && (
                    <Panel className="p-4 border border-border-subtle">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-text-muted" />
                            <h4 className="text-sm font-semibold text-text-primary">Growth Trend</h4>
                        </div>
                        <p className="text-sm text-text-secondary">{analysis.growthTrend}</p>
                    </Panel>
                )}
            </div>

            {/* Competitive Matrix */}
            {analysis.competitiveMatrix && analysis.competitiveMatrix.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                        <Swords className="h-4 w-4" />
                        Competitive Matrix
                    </h3>
                    <CompetitiveMatrix matrix={analysis.competitiveMatrix} />
                </section>
            )}

            {/* Key Trends */}
            {analysis.keyTrends.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Key Trends
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {analysis.keyTrends.map((trend, i) => (
                            <Panel key={i} className="p-3 border border-border-subtle">
                                <p className="text-sm text-text-secondary">{trend}</p>
                            </Panel>
                        ))}
                    </div>
                </section>
            )}

            {/* Opportunities & Threats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analysis.opportunities.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4 text-status-success-text" />
                            Opportunities
                        </h3>
                        <ul className="space-y-2">
                            {analysis.opportunities.map((opp, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                    <div className="h-1.5 w-1.5 rounded-full bg-status-success-text mt-1.5 shrink-0" />
                                    {opp}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {analysis.threats.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-status-error-text" />
                            Threats
                        </h3>
                        <ul className="space-y-2">
                            {analysis.threats.map((threat, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                    <div className="h-1.5 w-1.5 rounded-full bg-status-error-text mt-1.5 shrink-0" />
                                    {threat}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {/* Strategic Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {analysis.quickWins.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-status-warning-text" />
                            Quick Wins
                        </h3>
                        <ul className="space-y-2">
                            {analysis.quickWins.map((qw, i) => (
                                <li key={i} className="text-sm text-text-secondary">{qw}</li>
                            ))}
                        </ul>
                    </section>
                )}
                {analysis.longTermPlays.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4 text-status-info-text" />
                            Long-term Plays
                        </h3>
                        <ul className="space-y-2">
                            {analysis.longTermPlays.map((ltp, i) => (
                                <li key={i} className="text-sm text-text-secondary">{ltp}</li>
                            ))}
                        </ul>
                    </section>
                )}
                {analysis.strategicRecommendations.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-text-muted" />
                            Strategic Recommendations
                        </h3>
                        <ul className="space-y-2">
                            {analysis.strategicRecommendations.map((rec, i) => (
                                <li key={i} className="text-sm text-text-secondary">{rec}</li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {/* Market Gaps */}
            {analysis.marketGaps && analysis.marketGaps.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-text-primary mb-3">Market Gaps</h3>
                    <div className="flex flex-wrap gap-2">
                        {analysis.marketGaps.map((gap, i) => (
                            <Badge key={i} size="sm" variant="outline">{gap}</Badge>
                        ))}
                    </div>
                </section>
            )}
                </div>
                )}
            </div>
        </div>
    );
}
