"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    ArrowUpDown,
    Filter,
    CheckCircle2,
    XCircle,
    ChevronRight,
    ListChecks,
} from "lucide-react";
import { Panel, Button, Badge } from "@kletron/ui/components/design-system";
import type {
    FeatureProposal,
    FeatureType,
    FeatureStatus,
    FeatureSource,
} from "@kletron/shared/businessAnalystTypes";
import {
    FEATURE_TYPES,
    FEATURE_STATUSES,
    FEATURE_SOURCES,
} from "@kletron/shared/businessAnalystTypes";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchFeatures(params: Record<string, string>): Promise<FeatureProposal[]> {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/business-analyst/features?${query}`);
    if (!res.ok) throw new Error("Failed to fetch features");
    const data = await res.json();
    return data.features ?? [];
}

async function updateFeatureStatus(id: string, status: FeatureStatus, workspaceId?: string | null): Promise<void> {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (workspaceId) {
        (headers as any)["x-workspace-id"] = workspaceId;
    }
    const res = await fetch(`/api/business-analyst/features/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status, ...(workspaceId ? { workspaceId } : {}) }),
    });
    if (!res.ok) throw new Error("Failed to update feature status");
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
// Main Component
// ---------------------------------------------------------------------------

export function BAFeaturesListView() {
    const router = useRouter();
    const [features, setFeatures] = useState<FeatureProposal[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchText, setSearchText] = useState("");
    const [filterType, setFilterType] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [filterSource, setFilterSource] = useState<string>("");
    const [sortField, setSortField] = useState<"priority" | "innovationScore">("priority");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // Selection
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const { activeWorkspaceId } = useWorkspace();

    const load = useCallback(async () => {
        try {
            const params: Record<string, string> = {};
            if (searchText.trim()) params.search = searchText.trim();
            if (filterType) params.type = filterType;
            if (filterStatus) params.status = filterStatus;
            if (filterSource) params.source = filterSource;
            if (activeWorkspaceId) params.workspaceId = activeWorkspaceId;
            const data = await fetchFeatures(params);
            setFeatures(data);
        } catch (e) {
            console.error("Failed to load features:", e);
        } finally {
            setLoading(false);
        }
    }, [searchText, filterType, filterStatus, filterSource, activeWorkspaceId]);

    useEffect(() => {
        void load();
    }, [load]);

    // Sort features
    const sorted = [...features].sort((a, b) => {
        let aVal = 0;
        let bVal = 0;
        if (sortField === "priority") { aVal = a.priority; bVal = b.priority; }
        else if (sortField === "innovationScore") { aVal = a.innovationScore ?? 0; bVal = b.innovationScore ?? 0; }
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    const handleBulkAction = async (status: FeatureStatus) => {
        for (const id of selected) {
            await updateFeatureStatus(id, status, activeWorkspaceId);
        }
        setSelected(new Set());
        await load();
    };

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <ListChecks className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Feature Proposals</h1>
                        <p className="text-sm text-text-muted">
                            Discovered features and improvement opportunities
                        </p>
                    </div>
                </div>
                <Link href="/app/business-analyst/config">
                    <Button size="sm" variant="secondary">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Configure Context
                    </Button>
                </Link>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                    <input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search features..."
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                >
                    <option value="">All Types</option>
                    {FEATURE_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                >
                    <option value="">All Statuses</option>
                    {FEATURE_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                </select>
                <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                >
                    <option value="">All Sources</option>
                    {FEATURE_SOURCES.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                </select>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
            <div className="space-y-4">
            {/* Bulk Actions */}
            {selected.size > 0 && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-bg-elevated border border-border-subtle">
                    <span className="text-xs text-text-muted">{selected.size} selected</span>
                    <Button size="sm" variant="secondary" onClick={() => handleBulkAction("validated")}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Validate
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleBulkAction("rejected")}>
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                    </Button>
                    <button
                        onClick={() => setSelected(new Set())}
                        className="text-xs text-text-muted hover:text-text-secondary ml-auto"
                    >
                        Clear selection
                    </button>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-sm text-text-muted animate-pulse">Loading features...</div>
                </div>
            ) : sorted.length === 0 ? (
                <Panel className="p-8 border border-border-subtle text-center">
                    <Filter className="h-6 w-6 text-text-muted mx-auto mb-2" />
                    <p className="text-sm text-text-muted">
                        No features found. Run a Business Analysis to discover feature opportunities.
                    </p>
                </Panel>
            ) : (
                <div className="border border-border-subtle rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-bg-elevated border-b border-border-subtle">
                                <th className="w-8 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selected.size === sorted.length && sorted.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelected(new Set(sorted.map((f) => f.id)));
                                            } else {
                                                setSelected(new Set());
                                            }
                                        }}
                                        className="rounded border-border-subtle"
                                    />
                                </th>
                                <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Title</th>
                                <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Type</th>
                                <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                                <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Value</th>
                                <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Effort</th>
                                <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("priority"); setSortDir(sortDir === "desc" ? "asc" : "desc"); }}>
                                    <span className="flex items-center gap-1">Priority <ArrowUpDown className="h-3 w-3" /></span>
                                </th>
                                <th className="text-left px-3 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("innovationScore"); setSortDir(sortDir === "desc" ? "asc" : "desc"); }}>
                                    <span className="flex items-center gap-1">Innovation <ArrowUpDown className="h-3 w-3" /></span>
                                </th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((feature) => (
                                <tr
                                    key={feature.id}
                                    className="border-b border-border-subtle hover:bg-state-hover transition-colors cursor-pointer"
                                    onClick={() => router.push(`/app/business-analyst/features/${feature.id}`)}
                                >
                                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selected.has(feature.id)}
                                            onChange={() => toggleSelect(feature.id)}
                                            className="rounded border-border-subtle"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <p className="text-sm font-medium text-text-primary truncate max-w-[300px]">{feature.title}</p>
                                        <p className="text-[11px] text-text-muted truncate max-w-[300px]">{feature.summary}</p>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Badge size="xs" variant={featureTypeBadgeVariant(feature.type)}>
                                            {feature.type.replace("_", " ")}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Badge size="xs" variant={statusBadgeVariant(feature.status)}>
                                            {feature.status.replace("_", " ")}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Badge size="xs" variant={priorityBadgeVariant(feature.businessValue)}>
                                            {feature.businessValue}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs font-mono text-text-secondary">{feature.effort}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-sm font-mono text-text-primary">{feature.priority}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-sm font-mono text-text-secondary">
                                            {feature.innovationScore ?? "-"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            </div>
            </div>
        </div>
    );
}
