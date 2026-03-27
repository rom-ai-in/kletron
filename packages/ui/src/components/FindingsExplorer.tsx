"use client";

import React, { useState, useMemo } from "react";
import { Search, Filter, ChevronDown, ChevronRight, FileCode, AlertTriangle, Info, XCircle } from "lucide-react";
import type { Finding } from "@kletron/shared/automationTypes";

interface FindingsExplorerProps {
    findings: Finding[];
    stages?: { id: string; name: string }[];
    className?: string;
}

type SeverityFilter = "ALL" | "BLOQUANT" | "WARNING" | "INFO";

function SeverityBadge({ type }: { type: Finding["type"] }) {
    const styles: Record<string, string> = {
        BLOQUANT: "bg-red-500/15 text-red-400 border-red-500/30",
        WARNING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        INFO: "bg-zinc-400/15 text-zinc-400 border-zinc-400/30",
    };
    const icons: Record<string, React.ReactNode> = {
        BLOQUANT: <XCircle className="h-3 w-3" />,
        WARNING: <AlertTriangle className="h-3 w-3" />,
        INFO: <Info className="h-3 w-3" />,
    };
    return (
        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[type] || styles.INFO}`}>
            {icons[type] || icons.INFO}
            {type}
        </span>
    );
}

export function FindingsExplorer({ findings, stages = [], className = "" }: FindingsExplorerProps) {
    const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
    const [stageFilter, setStageFilter] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());

    // Filter findings
    const filteredFindings = useMemo(() => {
        return findings.filter((f) => {
            if (severityFilter !== "ALL" && f.type !== severityFilter) return false;
            if (stageFilter !== "ALL" && f.stageId !== stageFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesFile = f.file?.toLowerCase().includes(q);
                const matchesDesc = f.description?.toLowerCase().includes(q);
                if (!matchesFile && !matchesDesc) return false;
            }
            return true;
        });
    }, [findings, severityFilter, stageFilter, searchQuery]);

    // Group by file
    const groupedByFile = useMemo(() => {
        const groups = new Map<string, { findings: Finding[]; indices: number[] }>();
        filteredFindings.forEach((f, idx) => {
            const key = f.file || "unknown";
            const existing = groups.get(key) || { findings: [], indices: [] };
            existing.findings.push(f);
            existing.indices.push(idx);
            groups.set(key, existing);
        });
        return groups;
    }, [filteredFindings]);

    // Stats
    const stats = useMemo(() => {
        const bloquant = findings.filter((f) => f.type === "BLOQUANT").length;
        const warning = findings.filter((f) => f.type === "WARNING").length;
        const info = findings.filter((f) => f.type === "INFO").length;
        return { bloquant, warning, info, total: findings.length };
    }, [findings]);

    const toggleFile = (file: string) => {
        setExpandedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(file)) next.delete(file);
            else next.add(file);
            return next;
        });
    };

    const toggleFinding = (idx: number) => {
        setExpandedFindings((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    // Unique stages from findings
    const availableStages = useMemo(() => {
        const stageIds = new Set(findings.map((f) => f.stageId));
        return Array.from(stageIds).map((id) => {
            const stageConfig = stages.find((s) => s.id === id);
            return { id, name: stageConfig?.name || id };
        });
    }, [findings, stages]);

    if (findings.length === 0) {
        return (
            <div className={`rounded-lg border border-border-subtle bg-bg-surface p-8 text-center ${className}`}>
                <div className="text-sm text-text-muted">No findings recorded for this run.</div>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Stats Bar */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-text-primary">{stats.total} Findings</span>
                <div className="flex items-center gap-2">
                    {stats.bloquant > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                            {stats.bloquant} Critical
                        </span>
                    )}
                    {stats.warning > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                            {stats.warning} Warning
                        </span>
                    )}
                    {stats.info > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-400/15 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                            {stats.info} Info
                        </span>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search files or descriptions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                </div>

                {/* Severity Filter */}
                <div className="flex items-center gap-1">
                    {(["ALL", "BLOQUANT", "WARNING", "INFO"] as const).map((sev) => (
                        <button
                            key={sev}
                            onClick={() => setSeverityFilter(sev)}
                            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                                severityFilter === sev
                                    ? sev === "BLOQUANT" ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : sev === "WARNING" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : sev === "INFO" ? "bg-zinc-400/20 text-zinc-400 border border-zinc-400/30"
                                    : "bg-state-selected text-text-primary border border-border-strong"
                                    : "text-text-muted border border-transparent hover:bg-state-hover hover:text-text-secondary"
                            }`}
                        >
                            {sev === "ALL" ? "All" : sev}
                        </button>
                    ))}
                </div>

                {/* Stage Filter */}
                {availableStages.length > 1 && (
                    <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                    >
                        <option value="ALL">All stages</option>
                        {availableStages.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Filtered count */}
            {(severityFilter !== "ALL" || stageFilter !== "ALL" || searchQuery) && (
                <div className="text-[10px] text-text-muted">
                    Showing {filteredFindings.length} of {findings.length} findings
                    <button
                        onClick={() => { setSeverityFilter("ALL"); setStageFilter("ALL"); setSearchQuery(""); }}
                        className="ml-2 text-text-secondary hover:text-text-primary underline"
                    >
                        Clear filters
                    </button>
                </div>
            )}

            {/* Grouped Findings */}
            <div className="space-y-2">
                {Array.from(groupedByFile.entries()).map(([file, group]) => {
                    const isExpanded = expandedFiles.has(file);
                    const isUnknown = file === "unknown";
                    return (
                        <div key={file} className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
                            {/* File header */}
                            <button
                                onClick={() => toggleFile(file)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-state-hover transition"
                            >
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-text-muted flex-none" /> : <ChevronRight className="h-3.5 w-3.5 text-text-muted flex-none" />}
                                <FileCode className="h-3.5 w-3.5 text-text-muted flex-none" />
                                <span className={`text-xs font-medium truncate ${isUnknown ? "text-text-muted italic" : "text-text-primary font-mono"}`}>
                                    {isUnknown ? "General findings (no file)" : file}
                                </span>
                                <span className="ml-auto flex-none text-[10px] text-text-muted">
                                    {group.findings.length} {group.findings.length === 1 ? "finding" : "findings"}
                                </span>
                                <div className="flex-none flex gap-1">
                                    {group.findings.some((f) => f.type === "BLOQUANT") && (
                                        <span className="h-2 w-2 rounded-full bg-red-400" />
                                    )}
                                    {group.findings.some((f) => f.type === "WARNING") && (
                                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                                    )}
                                </div>
                            </button>

                            {/* Findings */}
                            {isExpanded && (
                                <div className="border-t border-border-subtle divide-y divide-border-subtle">
                                    {group.findings.map((finding, localIdx) => {
                                        const globalIdx = group.indices[localIdx];
                                        const isFindingExpanded = expandedFindings.has(globalIdx);
                                        const isLong = (finding.description?.length || 0) > 200;
                                        const stageName = stages.find((s) => s.id === finding.stageId)?.name || finding.stageId;

                                        return (
                                            <div key={globalIdx} className="px-3 py-2.5 hover:bg-state-hover/50 transition">
                                                <div className="flex items-start gap-2">
                                                    <SeverityBadge type={finding.type} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-xs text-text-secondary leading-relaxed ${!isFindingExpanded && isLong ? "line-clamp-3" : ""}`}>
                                                            {finding.description}
                                                        </p>
                                                        {isLong && (
                                                            <button
                                                                onClick={() => toggleFinding(globalIdx)}
                                                                className="mt-1 text-[10px] text-text-muted hover:text-text-primary underline"
                                                            >
                                                                {isFindingExpanded ? "Show less" : "Show more"}
                                                            </button>
                                                        )}
                                                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
                                                            {finding.lineStart && (
                                                                <span className="font-mono">
                                                                    L{finding.lineStart}{finding.lineEnd ? `–${finding.lineEnd}` : ""}
                                                                </span>
                                                            )}
                                                            <span>{stageName}</span>
                                                            {finding.verificationStatus && (
                                                                <span className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${
                                                                    finding.verificationStatus === "VERIFIED" ? "bg-status-success-bg text-status-success-text" :
                                                                    finding.verificationStatus === "REJECTED" ? "bg-status-error-bg text-status-error-text" :
                                                                    "bg-zinc-400/10 text-zinc-400"
                                                                }`}>
                                                                    {finding.verificationStatus}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {filteredFindings.length === 0 && (
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-center text-xs text-text-muted">
                    No findings match your filters.
                </div>
            )}
        </div>
    );
}
