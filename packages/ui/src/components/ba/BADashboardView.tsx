"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    TrendingUp,
    Sparkles,
    Target,
    Clock,
    Play,
    Zap,
    Swords,
    ArrowRight,
    ListChecks,
} from "lucide-react";
import { Panel, Button, Badge } from "@numezis/ui/components/design-system";
import type { BADashboardSummary, FeatureProposal, FeatureType } from "@numezis/shared/businessAnalystTypes";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchDashboard(): Promise<BADashboardSummary> {
    const res = await fetch("/api/business-analyst/dashboard");
    if (!res.ok) throw new Error("Failed to fetch dashboard");
    const data = await res.json();
    return data.summary;
}

async function triggerAnalysis(preset: string): Promise<string | null> {
    const res = await fetch("/api/business-analyst/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
    });
    if (!res.ok) return null;
    return (await res.json()).automationId;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const featureTypeBadgeVariant = (type: FeatureType) => {
    switch (type) {
        case "new_feature": return "info" as const;
        case "improvement": return "success" as const;
        case "fix": return "error" as const;
        case "optimization": return "warning" as const;
        case "innovation": return "running" as const;
        case "competitive": return "pending" as const;
        case "technical_debt": return "paused" as const;
        case "compliance": return "outline" as const;
        default: return "default" as const;
    }
};

const priorityBadgeVariant = (value: string) => {
    switch (value) {
        case "CRITICAL": return "error" as const;
        case "HIGH": return "warning" as const;
        case "MEDIUM": return "info" as const;
        case "LOW": return "default" as const;
        default: return "default" as const;
    }
};

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
    icon: Icon,
    label,
    value,
    sub,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
}) {
    return (
        <Panel className="p-4 border border-border-subtle">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-bg-elevated">
                    <Icon className="h-4 w-4 text-text-muted" />
                </div>
                <div>
                    <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
                    <p className="text-lg font-semibold text-text-primary">{value}</p>
                    {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
                </div>
            </div>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Feature Row
// ---------------------------------------------------------------------------

function FeatureRow({ feature }: { feature: FeatureProposal }) {
    return (
        <Link
            href={`/app/business-analyst/features/${feature.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-border-strong transition-colors group"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-text-primary">
                        {feature.title}
                    </p>
                    <Badge size="xs" variant={featureTypeBadgeVariant(feature.type)}>
                        {feature.type.replace("_", " ")}
                    </Badge>
                </div>
                <p className="text-xs text-text-muted truncate mt-0.5">{feature.summary}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Badge size="xs" variant={priorityBadgeVariant(feature.businessValue)}>
                    {feature.businessValue}
                </Badge>
                <span className="text-xs font-mono text-text-muted">{feature.priority}</span>
                <ArrowRight className="h-3.5 w-3.5 text-text-muted group-hover:text-text-primary transition-colors" />
            </div>
        </Link>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BADashboardView() {
    const [summary, setSummary] = useState<BADashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await fetchDashboard();
            setSummary(data);
        } catch (e) {
            console.error("Failed to load dashboard:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleAnalyze = async (preset: string) => {
        setAnalyzing(preset);
        try {
            const automationId = await triggerAnalysis(preset);
            if (automationId) {
                // Redirect to automation detail to watch progress
                window.location.href = `/app/automations/${automationId}`;
            }
        } catch (e) {
            console.error("Failed to trigger analysis:", e);
        } finally {
            setAnalyzing(null);
        }
    };

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Business Analyst</h1>
                        <p className="text-sm text-text-muted">
                            AI-powered feature discovery, competitive analysis &amp; requirements drafting
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/app/business-analyst/features">
                        <Button size="sm" variant="secondary">
                            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                            Features
                        </Button>
                    </Link>
                    <Link href="/app/business-analyst/market">
                        <Button size="sm" variant="secondary">
                            <Target className="h-3.5 w-3.5 mr-1.5" />
                            Market
                        </Button>
                    </Link>
                    <Link href="/app/business-analyst/config">
                        <Button size="sm" variant="ghost">
                            Config
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-sm text-text-muted animate-pulse">Loading dashboard...</div>
                    </div>
                ) : (
                <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={ListChecks}
                    label="Total Features"
                    value={summary?.totalFeatures ?? 0}
                    sub={`${summary?.byStatus.validated ?? 0} validated`}
                />
                <StatCard
                    icon={Sparkles}
                    label="Innovation Score"
                    value={summary?.innovationScore != null ? `${summary.innovationScore}/100` : "N/A"}
                    sub="Average across features"
                />
                <StatCard
                    icon={Swords}
                    label="Competitive Score"
                    value={summary?.competitiveScore != null ? `${summary.competitiveScore}/100` : "N/A"}
                    sub="vs. competitors"
                />
                <StatCard
                    icon={Clock}
                    label="Last Analysis"
                    value={summary?.lastAnalysis ? new Date(summary.lastAnalysis).toLocaleDateString() : "Never"}
                    sub={summary?.lastAnalysis ? new Date(summary.lastAnalysis).toLocaleTimeString() : "Run your first analysis"}
                />
            </div>

            {/* Top Features + Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Priority Features */}
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-text-primary">Top Priority Features</h3>
                        <Link
                            href="/app/business-analyst/features"
                            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                            View all &rarr;
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {summary?.topPriorityFeatures.length ? (
                            summary.topPriorityFeatures.map((feature) => (
                                <FeatureRow key={feature.id} feature={feature} />
                            ))
                        ) : (
                            <Panel className="p-8 border border-border-subtle text-center">
                                <Target className="h-6 w-6 text-text-muted mx-auto mb-2" />
                                <p className="text-sm text-text-muted">
                                    No features yet. Run an analysis to discover feature opportunities.
                                </p>
                            </Panel>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div>
                    <h3 className="text-sm font-semibold text-text-primary mb-3">Quick Actions</h3>
                    <div className="space-y-3">
                        <Panel className="p-4 border border-border-subtle">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-status-success-bg">
                                    <Play className="h-4 w-4 text-status-success-text" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary">Full Analysis</p>
                                    <p className="text-[11px] text-text-muted mt-0.5">
                                        Complete BA pipeline: market, competitive, features, requirements, scoring
                                    </p>
                                    <Button
                                        size="sm"
                                        className="mt-2"
                                        onClick={() => handleAnalyze("BUSINESS_ANALYSIS_FULL")}
                                        disabled={analyzing !== null}
                                    >
                                        {analyzing === "BUSINESS_ANALYSIS_FULL" ? "Starting..." : "Run Full Analysis"}
                                    </Button>
                                </div>
                            </div>
                        </Panel>

                        <Panel className="p-4 border border-border-subtle">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-status-warning-bg">
                                    <Zap className="h-4 w-4 text-status-warning-text" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary">Quick Brainstorm</p>
                                    <p className="text-[11px] text-text-muted mt-0.5">
                                        Fast feature ideation in ~15 minutes
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-2"
                                        onClick={() => handleAnalyze("QUICK_FEATURE_BRAINSTORM")}
                                        disabled={analyzing !== null}
                                    >
                                        {analyzing === "QUICK_FEATURE_BRAINSTORM" ? "Starting..." : "Quick Brainstorm"}
                                    </Button>
                                </div>
                            </div>
                        </Panel>

                        <Panel className="p-4 border border-border-subtle">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-status-info-bg">
                                    <Swords className="h-4 w-4 text-status-info-text" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary">Competitive Deep Dive</p>
                                    <p className="text-[11px] text-text-muted mt-0.5">
                                        In-depth competitive analysis with matrix
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-2"
                                        onClick={() => handleAnalyze("COMPETITIVE_DEEP_DIVE")}
                                        disabled={analyzing !== null}
                                    >
                                        {analyzing === "COMPETITIVE_DEEP_DIVE" ? "Starting..." : "Deep Dive"}
                                    </Button>
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>

            {/* Feature Distribution */}
            {summary && summary.totalFeatures > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-text-primary mb-3">Feature Distribution</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                        {Object.entries(summary.byType)
                            .filter(([_, count]) => count > 0)
                            .sort(([, a], [, b]) => b - a)
                            .map(([type, count]) => (
                                <Panel key={type} className="p-3 border border-border-subtle text-center">
                                    <p className="text-lg font-semibold text-text-primary">{count}</p>
                                    <p className="text-[10px] text-text-muted uppercase tracking-wider">
                                        {type.replace("_", " ")}
                                    </p>
                                </Panel>
                            ))
                        }
                    </div>
                </div>
            )}
                </div>
                )}
            </div>
        </div>
    );
}
