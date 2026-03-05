"use client";

import { useState, useEffect } from "react";
import { Panel, Button } from "@numezis/ui/components/design-system";
import {
    History,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Clock,
    FileCode,
    Layers,
    Play,
    Zap,
    Download,
    Terminal,
    Calendar
} from "lucide-react";
import Link from "next/link";
import { type VectorIndexRun } from "@numezis/server/services/vectorHistoryService";
import { RequireWorkspace } from "@numezis/ui/components/workspace/RequireWorkspace";

export default function VectorHistoryPage() {
    return (
        <RequireWorkspace message="Select a workspace to inspect vector indexing history.">
            <VectorHistoryContent />
        </RequireWorkspace>
    );
}

function VectorHistoryContent() {
    const [runs, setRuns] = useState<(Omit<VectorIndexRun, "_id"> & { _id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRun, setSelectedRun] = useState<(Omit<VectorIndexRun, "_id"> & { _id: string }) | null>(null);

    useEffect(() => {
        fetch("/api/vectors/history?limit=50")
            .then(res => res.json())
            .then(data => {
                setRuns(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        if (m > 0) return `${m}m ${s % 60}s`;
        return `${s}s`;
    };

    const formatDate = (dateStr: Date | string) => {
        return new Date(dateStr).toLocaleString();
    };

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/app/vectors">
                        <Button variant="secondary" size="sm" className="h-8 w-8 p-0 rounded-full">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-500/10 text-zinc-400">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary">Indexing History</h1>
                            <p className="text-sm text-text-muted">Run log of vector indexing operations</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                        <Clock className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6 gap-6 flex">
                {/* List */}
                <Panel className="flex-1 flex flex-col p-0 overflow-hidden">
                    <div className="p-4 border-b border-border-subtle bg-bg-surface/50 flex justify-between items-center">
                        <div className="text-xs font-bold uppercase tracking-widest text-text-muted">Run History</div>
                        <div className="text-xs text-text-muted">{runs.length} records</div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-elegant">
                        {loading && (
                            <div className="p-8 text-center text-text-muted italic">Loading history...</div>
                        )}
                        {!loading && runs.length === 0 && (
                            <div className="p-8 text-center text-text-muted italic">No indexing history found</div>
                        )}

                        <div className="divide-y divide-border-subtle">
                            {runs.map((run) => (
                                <button
                                    key={run._id}
                                    onClick={() => setSelectedRun(run)}
                                    className={`w-full flex items-center justify-between p-4 text-left transition hover:bg-bg-elevated ${selectedRun?._id === run._id ? 'bg-bg-elevated border-l-2 border-l-zinc-400' : 'border-l-2 border-l-transparent'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${run.status === 'success' ? 'bg-status-success-bg text-status-success-text' : run.status === 'partial_error' ? 'bg-zinc-500/10 text-zinc-400' : 'bg-status-error-bg text-status-error-text'}`}>
                                            {run.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
                                                run.status === 'partial_error' ? <AlertCircle className="h-4 w-4" /> :
                                                    <XCircle className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-semibold text-text-primary">
                                                    {run.trigger === 'auto' ? 'Auto-Index' : 'Manual Index'}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-app border border-border-subtle text-text-muted font-mono">
                                                    {formatDuration(run.durationMs)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-text-secondary">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(run.end)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 text-xs text-text-secondary">
                                        <div className="text-right">
                                            <div className="font-semibold text-text-primary">{run.processedFiles}</div>
                                            <div className="text-[10px] text-text-muted">Files</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-text-primary">{run.chunksGenerated}</div>
                                            <div className="text-[10px] text-text-muted">New Chunks</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </Panel>

                {/* Detail View */}
                {selectedRun ? (
                    <Panel className="w-[400px] flex flex-col p-0 overflow-hidden border-border-strong shadow-lg">
                        <div className="p-4 border-b border-border-subtle bg-bg-surface">
                            <h2 className="text-sm font-semibold text-text-primary mb-1">Run Details</h2>
                            <div className="text-xs text-text-muted font-mono break-all">{selectedRun._id}</div>
                        </div>

                        <div className="p-4 border-b border-border-subtle grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Status</div>
                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${selectedRun.status === 'success' ? 'bg-status-success-bg text-status-success-text' : selectedRun.status === 'partial_error' ? 'bg-zinc-500/10 text-zinc-400' : 'bg-status-error-bg text-status-error-text'}`}>
                                    {selectedRun.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : selectedRun.status === 'partial_error' ? <AlertCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                    <span className="capitalize">{selectedRun.status.replace('_', ' ')}</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Duration</div>
                                <div className="text-sm font-mono text-text-primary">{formatDuration(selectedRun.durationMs)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Start Time</div>
                                <div className="text-xs text-text-primary">{formatDate(selectedRun.start)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">End Time</div>
                                <div className="text-xs text-text-primary">{formatDate(selectedRun.end)}</div>
                            </div>
                        </div>

                        <div className="p-4 border-b border-border-subtle space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">Files Processed</span>
                                <span className="font-mono text-text-primary">{selectedRun.processedFiles} / {selectedRun.totalFiles}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">Chunks Generated</span>
                                <span className="font-mono text-text-primary">{selectedRun.chunksGenerated}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">Trigger</span>
                                <span className="font-mono text-text-primary capitalize">{selectedRun.trigger}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">Repo</span>
                                <span className="font-mono text-text-primary truncate max-w-[200px]" title={selectedRun.repoPath}>
                                    {selectedRun.repoPath?.split('/').pop()}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden bg-bg-app/50">
                            <div className="p-3 border-b border-border-subtle flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-text-muted" />
                                <span className="text-xs font-semibold text-text-secondary">Execution Logs / Errors</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
                                {selectedRun.errors && selectedRun.errors.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedRun.errors.map((error, i) => (
                                            <div key={i} className="p-2 rounded bg-status-error-bg text-status-error-text border border-status-error-border break-words">
                                                {error}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-text-muted italic opacity-50">No errors reported for this run.</div>
                                )}
                            </div>
                        </div>
                    </Panel>
                ) : (
                    <div className="w-[400px] flex items-center justify-center text-text-muted italic border-l border-border-subtle bg-bg-app/50">
                        Select a run to view details
                    </div>
                )}
            </div>
        </div>
    );
}
