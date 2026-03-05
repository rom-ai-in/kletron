"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Calendar,
    Send,
    FileCode,
    AlertTriangle,
    Target,
    Sparkles,
    Link2,
    Pencil,
    Layers,
    Tag,
} from "lucide-react";
import { Panel, Button, Badge } from "@numezis/ui/components/design-system";
import { MarkdownRenderer } from "@numezis/ui/components/Agent/MarkdownRenderer";
import type { FeatureProposal, FeatureType, FeatureStatus } from "@numezis/shared/businessAnalystTypes";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchFeature(id: string): Promise<FeatureProposal | null> {
    const res = await fetch(`/api/business-analyst/features/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.feature;
}

async function updateFeatureStatus(id: string, status: FeatureStatus): Promise<boolean> {
    const res = await fetch(`/api/business-analyst/features/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    return res.ok;
}

// ---------------------------------------------------------------------------
// Helpers
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

const statusBadgeVariant = (status: FeatureStatus) => {
    switch (status) {
        case "draft": return "default" as const;
        case "analyzed": return "info" as const;
        case "validated": return "success" as const;
        case "rejected": return "error" as const;
        case "planned": return "warning" as const;
        case "in_progress": return "running" as const;
        case "shipped": return "completed" as const;
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
// Score Display
// ---------------------------------------------------------------------------

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const color =
        pct >= 75 ? "bg-status-success-text" :
            pct >= 50 ? "bg-status-warning-text" :
                pct >= 25 ? "bg-status-info-text" :
                    "bg-text-muted";

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">{label}</span>
                <span className="text-xs font-mono text-text-primary">{value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-bg-app overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BAFeatureDetailView({ featureId }: { featureId: string }) {
    const router = useRouter();
    const [feature, setFeature] = useState<FeatureProposal | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await fetchFeature(featureId);
            setFeature(data);
        } catch (e) {
            console.error("Failed to load feature:", e);
        } finally {
            setLoading(false);
        }
    }, [featureId]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleStatusChange = async (status: FeatureStatus) => {
        setActionLoading(true);
        try {
            const ok = await updateFeatureStatus(featureId, status);
            if (ok) await load();
        } catch (e) {
            console.error("Failed to update status:", e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendToAgent = () => {
        if (!feature) return;
        const params = new URLSearchParams({
            mission: `${feature.title}: ${feature.summary}`,
            goal: (feature.description ?? "").slice(0, 2000),
        });
        if (feature.acceptanceCriteria?.length) {
            params.set("acceptanceCriteria", feature.acceptanceCriteria.join("\n"));
        }
        router.push(`/app/agent?${params.toString()}`);
    };

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/app/business-analyst/features"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
                        title="Back to features"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    {loading ? (
                        <div className="text-sm text-text-muted animate-pulse">Loading feature...</div>
                    ) : !feature ? (
                        <div className="text-sm text-text-muted">Feature not found</div>
                    ) : (
                        <div className="flex items-center gap-3 min-w-0">
                            <h1 className="text-lg font-semibold text-text-primary truncate">{feature.title}</h1>
                            <Badge variant={featureTypeBadgeVariant(feature.type)}>
                                {feature.type.replace("_", " ")}
                            </Badge>
                            <Badge variant={statusBadgeVariant(feature.status)}>
                                {feature.status.replace("_", " ")}
                            </Badge>
                        </div>
                    )}
                </div>
                {feature && (
                    <div className="flex items-center gap-2 shrink-0">
                        {feature.status !== "validated" && feature.status !== "shipped" && (
                            <Button
                                size="sm"
                                onClick={() => handleStatusChange("validated")}
                                disabled={actionLoading}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Validate
                            </Button>
                        )}
                        {feature.status !== "rejected" && feature.status !== "shipped" && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleStatusChange("rejected")}
                                disabled={actionLoading}
                            >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Reject
                            </Button>
                        )}
                        {feature.status === "validated" && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleStatusChange("planned")}
                                disabled={actionLoading}
                            >
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                Plan
                            </Button>
                        )}
                        {(feature.status === "validated" || feature.status === "planned") && (
                            <Button
                                size="sm"
                                onClick={handleSendToAgent}
                            >
                                <Send className="h-3.5 w-3.5 mr-1" />
                                Send to Agent
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-sm text-text-muted animate-pulse">Loading feature...</div>
                    </div>
                ) : !feature ? (
                    <Panel className="p-8 border border-border-subtle text-center">
                        <p className="text-sm text-text-muted">Feature not found.</p>
                        <Link href="/app/business-analyst/features" className="text-sm text-text-secondary hover:text-text-primary mt-2 inline-block">
                            &larr; Back to features
                        </Link>
                    </Panel>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Summary */}
                            <Panel className="p-4 border border-border-subtle">
                                <p className="text-sm text-text-secondary">{feature.summary}</p>
                            </Panel>

                            {/* Description */}
                            <Panel className="p-4 border border-border-subtle">
                                <h3 className="text-sm font-semibold text-text-primary mb-3">Description</h3>
                                <div className="prose prose-sm prose-invert max-w-none">
                                    <MarkdownRenderer content={feature.description} />
                                </div>
                            </Panel>

                            {/* User Story */}
                            {feature.userStory && (
                                <Panel className="p-4 border border-border-subtle">
                                    <h3 className="text-sm font-semibold text-text-primary mb-2">User Story</h3>
                                    <p className="text-sm text-text-secondary italic">{feature.userStory}</p>
                                </Panel>
                            )}

                            {/* Acceptance Criteria */}
                            {feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0 && (
                                <Panel className="p-4 border border-border-subtle">
                                    <h3 className="text-sm font-semibold text-text-primary mb-3">Acceptance Criteria</h3>
                                    <ul className="space-y-2">
                                        {feature.acceptanceCriteria.map((criteria, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <div className="mt-1 h-4 w-4 rounded border border-border-subtle bg-bg-elevated shrink-0 flex items-center justify-center">
                                                    <span className="text-[10px] text-text-muted">{i + 1}</span>
                                                </div>
                                                <span className="text-sm text-text-secondary">{criteria}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </Panel>
                            )}

                            {/* Suggested Approach */}
                            {feature.suggestedApproach && (
                                <Panel className="p-4 border border-border-subtle">
                                    <h3 className="text-sm font-semibold text-text-primary mb-3">Suggested Approach</h3>
                                    <div className="prose prose-sm prose-invert max-w-none">
                                        <MarkdownRenderer content={feature.suggestedApproach} />
                                    </div>
                                </Panel>
                            )}
                        </div>

                        {/* Right Column - Sidebar */}
                        <div className="space-y-4">
                            {/* Scores */}
                            <Panel className="p-4 border border-border-subtle">
                                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Scores</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-text-muted">Business Value</span>
                                        <Badge size="xs" variant={priorityBadgeVariant(feature.businessValue)}>
                                            {feature.businessValue}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-text-muted">Effort</span>
                                        <span className="text-xs font-mono text-text-primary">{feature.effort}</span>
                                    </div>
                                    <ScoreBar label="Priority" value={feature.priority} />
                                    <ScoreBar label="Confidence" value={feature.confidenceScore} />
                                    {feature.innovationScore != null && (
                                        <ScoreBar label="Innovation" value={feature.innovationScore} />
                                    )}
                                </div>
                            </Panel>

                            {/* Competitive Context */}
                            {feature.competitiveContext && (
                                <Panel className="p-4 border border-border-subtle">
                                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" />
                                        Competitive Context
                                    </h4>
                                    <p className="text-xs text-text-secondary">{feature.competitiveContext}</p>
                                    {feature.competitors && feature.competitors.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {feature.competitors.map((c, i) => (
                                                <Badge key={i} size="xs" variant="outline">{c}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </Panel>
                            )}

                            {/* Impact & Risks */}
                            <Panel className="p-4 border border-border-subtle">
                                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Impact & Risks</h4>
                                {feature.impactAreas && feature.impactAreas.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Impact Areas</p>
                                        <div className="flex flex-wrap gap-1">
                                            {feature.impactAreas.map((area, i) => (
                                                <Badge key={i} size="xs" variant="info">{area}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {feature.risks && feature.risks.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Risks</p>
                                        <ul className="space-y-1">
                                            {feature.risks.map((risk, i) => (
                                                <li key={i} className="flex items-start gap-1 text-xs text-text-secondary">
                                                    <AlertTriangle className="h-3 w-3 text-status-warning-text mt-0.5 shrink-0" />
                                                    {risk}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {feature.dependencies && feature.dependencies.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Dependencies</p>
                                        <ul className="space-y-1">
                                            {feature.dependencies.map((dep, i) => (
                                                <li key={i} className="flex items-start gap-1 text-xs text-text-secondary">
                                                    <Link2 className="h-3 w-3 text-text-muted mt-0.5 shrink-0" />
                                                    {dep}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </Panel>

                            {/* Affected Files */}
                            {feature.affectedFiles && feature.affectedFiles.length > 0 && (
                                <Panel className="p-4 border border-border-subtle">
                                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <FileCode className="h-3 w-3" />
                                        Affected Files
                                    </h4>
                                    <ul className="space-y-1">
                                        {feature.affectedFiles.map((file, i) => (
                                            <li key={i} className="text-xs font-mono text-text-secondary truncate" title={file}>
                                                {file}
                                            </li>
                                        ))}
                                    </ul>
                                </Panel>
                            )}

                            {/* Metadata */}
                            <Panel className="p-4 border border-border-subtle">
                                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Metadata</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Source</span>
                                        <Badge size="xs" variant="outline">{feature.source.replace("_", " ")}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Created</span>
                                        <span className="text-text-secondary">{new Date(feature.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Updated</span>
                                        <span className="text-text-secondary">{new Date(feature.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                    {feature.analysisRunId && (
                                        <div className="flex justify-between">
                                            <span className="text-text-muted">Analysis Run</span>
                                            <Link
                                                href={`/app/automations/${feature.analysisRunId}`}
                                                className="text-text-secondary hover:text-text-primary truncate max-w-[120px]"
                                            >
                                                {feature.analysisRunId.slice(0, 8)}...
                                            </Link>
                                        </div>
                                    )}
                                </div>
                                {feature.tags && feature.tags.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {feature.tags.map((tag, i) => (
                                            <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-bg-app text-text-muted border border-border-subtle">
                                                <Tag className="h-2.5 w-2.5" />
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </Panel>

                            {/* Related Features */}
                            {feature.relatedFeatureIds && feature.relatedFeatureIds.length > 0 && (
                                <Panel className="p-4 border border-border-subtle">
                                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Layers className="h-3 w-3" />
                                        Related Features
                                    </h4>
                                    <ul className="space-y-1">
                                        {feature.relatedFeatureIds.map((id, i) => (
                                            <li key={i}>
                                                <Link
                                                    href={`/app/business-analyst/features/${id}`}
                                                    className="text-xs text-text-secondary hover:text-text-primary"
                                                >
                                                    {id.slice(0, 8)}...
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </Panel>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
