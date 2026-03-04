"use client";

import { useEffect, useState, useMemo } from "react";
import {
    GitCommit,
    Calendar,
    User,
    Search,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    FileCode,
    History,
    Clock,
    AlertTriangle,
    ShieldAlert
} from "lucide-react";
import { Button, Panel, Breadcrumbs } from "@numezis/ui/components/design-system";
import { FolderTreePicker } from "@numezis/ui/components/ui/FolderTreePicker";
import { DriftAnalysisModal } from "@numezis/ui/components/drift/DriftAnalysisModal";
import { RequireWorkspace } from "@numezis/ui/components/workspace/RequireWorkspace";
import { ActiveWorkspaceBanner } from "@numezis/ui/components/workspace/ActiveWorkspaceBanner";
import { useWorkspace } from "@numezis/ui/context/WorkspaceContext";

export interface DiffChunk {
    sha: string;
    author: string;
    date: string;
    message: string;
    diff: string;
    isWorkingTree?: boolean;
}


export default function ChangesPage() {
    return (
        <RequireWorkspace message="Select a workspace to inspect git diffs and code changes.">
            <ChangesPageContent />
        </RequireWorkspace>
    );
}

function ChangesPageContent() {
    const { activeWorkspace } = useWorkspace();
    const [path, setPath] = useState("src/");
    const [granularity, setGranularity] = useState<"hour" | "day" | "week">("day");

    // Default to last 24h
    const [start, setStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 16);
    });
    const [end, setEnd] = useState(() => {
        return new Date().toISOString().slice(0, 16);
    });

    const [diffs, setDiffs] = useState<DiffChunk[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [driftOpen, setDriftOpen] = useState(false);

    const fetchDiffs = async (newEnd?: string) => {
        setLoading(true);
        setError(null);
        try {
            const currentEnd = newEnd || end;
            const params = new URLSearchParams();
            params.set("path", path);
            params.set("start", new Date(start).toISOString());
            params.set("end", new Date(currentEnd).toISOString());
            params.set("granularity", granularity);

            const res = await fetch(`/api/git-diffs?${params.toString()}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to fetch diffs");
            }
            const data = await res.json();
            setDiffs(data.diffs);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchDiffs();
    }, []);

    const getBucketKey = (dateStr: string) => {
        const d = new Date(dateStr);
        if (granularity === "hour") {
            return d.toISOString().slice(0, 13) + ":00";
        }
        if (granularity === "day") {
            return d.toISOString().slice(0, 10);
        }
        // Simple ISO week
        const target = new Date(d.valueOf());
        const dayNr = (d.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
        }
        const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
        return `${d.getFullYear()}-W${weekNum}`;
    };

    const groupedDiffs = useMemo(() => {
        const groups: Record<string, DiffChunk[]> = {};
        diffs.forEach(d => {
            const key = getBucketKey(d.date);
            if (!groups[key]) groups[key] = [];
            groups[key].push(d);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [diffs, granularity]);

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <ActiveWorkspaceBanner />
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <History className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Code Comparator</h1>
                        <p className="text-sm text-text-muted">Inspect exact diffs and code edits from the local repository</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDriftOpen(true)}
                    >
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Run Drift Analysis
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            const now = new Date().toISOString().slice(0, 16);
                            setEnd(now);
                            void fetchDiffs(now);
                        }}
                        disabled={loading}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <DriftAnalysisModal open={driftOpen} onClose={() => setDriftOpen(false)} />
                </div>
            </div>

            {/* Filter Area */}
            <div className="shrink-0 border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_140px_160px_auto]">
                    <div className="relative">
                        <FolderTreePicker
                            value={path}
                            onChange={(newPath) => setPath(newPath)}
                            placeholder="Select target folder..."
                        />
                    </div>


                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Clock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                            <select
                                className="w-full rounded-md border border-border-subtle bg-bg-elevated pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none appearance-none"
                                value={granularity}
                                onChange={(e) => setGranularity(e.target.value as any)}
                            >
                                <option value="hour">Hourly</option>
                                <option value="day">Daily</option>
                                <option value="week">Weekly</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center">
                        <input
                            type="datetime-local"
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary focus:border-border-strong focus:outline-none"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col justify-center">
                        <input
                            type="datetime-local"
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary focus:border-border-strong focus:outline-none"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                        />
                    </div>

                    <Button variant="primary" onClick={() => void fetchDiffs()} disabled={loading} className="px-6">
                        Apply
                    </Button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-text-muted">
                        Total changes found: <span className="font-semibold text-text-primary">{diffs.length}</span>
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                        Targeting: <span className="font-mono text-text-secondary">{activeWorkspace?.rootPath || 'No workspace'}</span>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 pb-10 overflow-y-auto scrollbar-elegant">
                {error && (
                    <div className="mb-6 rounded-lg border border-status-error-border bg-status-error-bg p-4 text-xs text-status-error-text flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <div>
                            <p className="font-semibold mb-1">Service Error</p>
                            <p className="font-mono opacity-80 break-all">{error}</p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-muted animate-pulse">
                        <RefreshCw className="h-6 w-6 mb-3 animate-spin opacity-20" />
                        <p className="text-xs font-medium tracking-wide">SCANNING REPOSITORY...</p>
                    </div>
                ) : diffs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed border-border-subtle bg-bg-surface/50">
                        <GitCommit className="h-10 w-10 text-text-muted opacity-10 mb-4" />
                        <h3 className="text-sm font-medium text-text-secondary">No edits found in this window</h3>
                        <p className="text-xs text-text-muted mt-1">Try expanding the date range or changing the target path.</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {groupedDiffs.map(([group, items]) => (
                            <section key={group} className="relative">
                                {/* Group sticky header */}
                                <div className="sticky top-0 z-10 flex items-center gap-3 py-2 bg-bg-app/80 backdrop-blur-sm mb-6">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-elevated text-text-muted">
                                        <Calendar className="h-3.5 w-3.5" />
                                    </div>
                                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">{group}</h2>
                                    <div className="h-px flex-1 bg-border-subtle" />
                                    <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 rounded bg-bg-elevated border border-border-subtle">
                                        {items.length} {items.length === 1 ? 'change' : 'changes'}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {items.map((diff) => (
                                        <DiffItem key={diff.sha} diff={diff} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DiffItem({ diff }: { diff: DiffChunk }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className={`overflow-hidden rounded-lg border transition-all duration-200 ${isExpanded ? 'border-border-strong bg-bg-surface ring-1 ring-focus-ring/10' : 'border-border-subtle bg-bg-surface/50 hover:bg-bg-surface hover:border-border-strong shadow-sm'} ${diff.isWorkingTree ? 'border-zinc-500/30' : ''}`}>
            <div
                className="flex items-start gap-4 p-4 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors ${diff.isWorkingTree ? 'bg-zinc-500/20 text-zinc-400' : isExpanded ? 'bg-status-success-bg text-status-success-text' : 'bg-bg-elevated text-text-muted'}`}>
                    <GitCommit className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted">
                            <span className={`${diff.isWorkingTree ? 'text-zinc-400 bg-zinc-500/10' : 'text-status-success-text bg-status-success-bg'} font-bold px-1.5 py-0.5 rounded uppercase tracking-wider`}>
                                {diff.sha.slice(0, 7)}
                            </span>
                            <span className="flex items-center gap-1 text-text-secondary">
                                <User className="h-3 w-3" />
                                {diff.author}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(diff.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-elevated transition-colors">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                    </div>

                    <p className={`text-sm font-medium leading-relaxed transition-colors ${diff.isWorkingTree ? 'text-status-warning-text' : isExpanded ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                        {diff.message}
                    </p>

                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-border-subtle bg-bg-app">
                    <div className="p-4">
                        <div className="rounded-md overflow-hidden border border-border-subtle bg-black/20">
                            <div className="bg-bg-elevated px-3 py-1.5 border-b border-border-subtle flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileCode className="h-3 w-3 text-text-muted" />
                                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Patch content</span>
                                </div>
                            </div>
                            <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto scrollbar-elegant max-h-[600px]">
                                {diff.diff.split('\n').map((line, i) => {
                                    const isAdded = line.startsWith('+') && !line.startsWith('+++');
                                    const isRemoved = line.startsWith('-') && !line.startsWith('---');
                                    const isHeader = line.startsWith('diff') || line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@');

                                    let colorClass = 'text-text-muted opacity-70';
                                    if (isAdded) colorClass = 'bg-status-success-bg text-status-success-text font-medium px-1';
                                    if (isRemoved) colorClass = 'bg-status-error-bg text-status-error-text font-medium px-1';
                                    if (isHeader) colorClass = 'text-status-info-text font-bold opacity-100';

                                    return (
                                        <div
                                            key={i}
                                            className={`${colorClass} py-0.5 rounded-sm flex`}
                                        >
                                            <span className="select-none opacity-20 mr-4 w-8 shrink-0 text-right">{i + 1}</span>
                                            <span className="whitespace-pre">{line}</span>
                                        </div>
                                    );
                                })}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
