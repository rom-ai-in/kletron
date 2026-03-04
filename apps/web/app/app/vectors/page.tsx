"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Panel } from "@numezis/ui/components/ui/Panel";
import { Button } from "@numezis/ui/components/ui/Button";
import { Modal } from "@numezis/ui/components/ui/Modal";
import { EmptyState, ErrorState } from "@numezis/ui/components/ui/EmptyState";
import { Skeleton } from "@numezis/ui/components/ui/Skeleton";
import {
    Database,
    Settings,
    Search,
    RefreshCw,
    Trash2,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    FileCode,
    Play
} from "lucide-react";
import { useLlmHealth } from "@numezis/ui/hooks/useLlmHealth";
import { RequireWorkspace } from "@numezis/ui/components/workspace/RequireWorkspace";

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    azure: "Azure OpenAI",
    openai: "OpenAI",
    voyage: "Voyage AI",
    gemini: "Google Gemini",
    lmstudio: "LM Studio",
    ollama: "Ollama",
};

const VECTORS_CACHE_KEY = "numezis-vectors-cache";

type IndexStatus = {
    isIndexing: boolean;
    totalFiles: number;
    indexedFiles: number;
    totalChunks: number;
    lastIndexedAt?: string;
    currentFile?: string;
    errors: string[];
    errorCount?: number;
    autoIndexEnabled?: boolean;
    lastAutoIndex?: string;
    nextAutoIndex?: string;
    schedulerStatus?: 'idle' | 'running' | 'pending';
    schedulerInterval?: number;
    dimensions?: number;
};

type SearchResult = {
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    language: string;
    score: number;
};

export default function VectorIndexPage() {
    return (
        <RequireWorkspace message="Select a workspace to manage its vector index and semantic search.">
            <VectorIndexContent />
        </RequireWorkspace>
    );
}

function VectorIndexContent() {
    const [status, setStatus] = useState<IndexStatus | null>(null);
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        message: string;
        action: () => void;
    } | null>(null);
    const [topK, setTopK] = useState(5);

    const { status: healthStatus, message: healthMessage, recheck: recheckHealth } = useLlmHealth(config?.provider);

    const totalFiles = status?.totalFiles ?? 0;
    const indexedFiles = status?.indexedFiles ?? 0;
    const remainingFiles = Math.max(totalFiles - indexedFiles, 0);
    const progressPercent = totalFiles ? Math.round((indexedFiles / totalFiles) * 100) : 0;
    const remainingPercent = totalFiles ? Math.max(100 - progressPercent, 0) : 0;
    const isPartial = totalFiles > 0 && remainingFiles > 0;

    // Ref to track indexing state without causing effect re-runs
    const isIndexingRef = useRef(false);
    useEffect(() => {
        isIndexingRef.current = status?.isIndexing ?? false;
    }, [status?.isIndexing]);

    // Lightweight status-only fetch (used during polling)
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/vectors");
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                if (loadError) setLoadError(null);
                // Update localStorage cache
                try { localStorage.setItem(VECTORS_CACHE_KEY, JSON.stringify({ status: data, ts: Date.now() })); } catch { }
            } else {
                const data = await res.json().catch(() => ({}));
                setLoadError(data.error || `Failed to load vector status (${res.status})`);
            }
        } catch {
            // Silently ignore polling errors to avoid spamming the UI
        }
    }, [loadError]);

    // Full data fetch (status + config in parallel)
    const fetchData = useCallback(async (showLoader = false) => {
        if (showLoader) setIsLoading(true);
        setLoadError(null);
        try {
            const [statusRes, configRes] = await Promise.all([
                fetch("/api/vectors"),
                fetch("/api/embedding-config")
            ]);
            const errors: string[] = [];

            let statusData: IndexStatus | null = null;
            let configData: any = null;

            if (statusRes.ok) {
                statusData = await statusRes.json();
                setStatus(statusData);
            } else {
                const data = await statusRes.json().catch(() => ({}));
                errors.push(data.error || `Failed to load vector status (${statusRes.status})`);
            }

            if (configRes.ok) {
                configData = await configRes.json();
                setConfig(configData);
            } else {
                const data = await configRes.json().catch(() => ({}));
                errors.push(data.error || `Failed to load embedding config (${configRes.status})`);
            }

            if (errors.length) {
                setLoadError(errors.join(" • "));
            }

            // Persist to localStorage for stale-while-revalidate on next visit
            try {
                localStorage.setItem(VECTORS_CACHE_KEY, JSON.stringify({
                    status: statusData,
                    config: configData,
                    ts: Date.now()
                }));
            } catch { }
        } catch (error) {
            console.error("Failed to fetch vector data", error);
            setLoadError(error instanceof Error ? error.message : "Failed to fetch vector data");
        } finally {
            if (showLoader) setIsLoading(false);
        }
    }, []);

    // On mount: hydrate from localStorage immediately (stale-while-revalidate),
    // then fetch fresh data. Polling uses a ref so this effect never re-runs.
    useEffect(() => {
        // Hydrate cached state instantly so the page never shows a blank skeleton
        try {
            const raw = localStorage.getItem(VECTORS_CACHE_KEY);
            if (raw) {
                const cached = JSON.parse(raw);
                if (cached.status) setStatus(cached.status);
                if (cached.config) setConfig(cached.config);
                // Show content immediately, but still fetch fresh data below
                setIsLoading(false);
            }
        } catch { }

        // Fetch fresh data (shows loader only if no cached data)
        void fetchData(true);

        // Polling: 2 s when indexing, otherwise no polling
        const interval = setInterval(() => {
            if (isIndexingRef.current) void fetchStatus();
        }, 2000);

        return () => clearInterval(interval);
    }, [fetchData, fetchStatus]);

    // Debounced focus handler — at most once per 30 s, background refresh (no loader)
    useEffect(() => {
        let lastFocusFetch = 0;
        const FOCUS_DEBOUNCE_MS = 30_000;

        const handleFocus = () => {
            const now = Date.now();
            if (now - lastFocusFetch < FOCUS_DEBOUNCE_MS) return;
            lastFocusFetch = now;
            void fetchData(false);
        };

        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    const handleStartIndexing = (force = false) => {
        if (force) {
            setConfirmDialog({
                title: "Full Reindex",
                message: "Are you sure you want to perform a full reindex? This will delete all existing vector data and re-process the entire repository. This operation may take a significant amount of time.",
                action: async () => {
                    setIsActionLoading(true);
                    try {
                        await fetch("/api/vectors/reindex", { method: "POST" });
                        void fetchStatus();
                    } finally {
                        setIsActionLoading(false);
                        setConfirmDialog(null);
                    }
                }
            });
            return;
        }

        void (async () => {
            setIsActionLoading(true);
            try {
                await fetch("/api/vectors/index", { method: "POST" });
                void fetchStatus();
            } finally {
                setIsActionLoading(false);
            }
        })();
    };

    const handleContinueIndexing = () => {
        void (async () => {
            setIsActionLoading(true);
            try {
                await fetch("/api/vectors/index", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ resume: true }),
                });
                void fetchStatus();
            } finally {
                setIsActionLoading(false);
            }
        })();
    };

    const handleClearIndex = () => {
        setConfirmDialog({
            title: "Clear Vectors",
            message: "Are you sure you want to clear all vectors? This cannot be undone.",
            action: async () => {
                setIsActionLoading(true);
                try {
                    await fetch("/api/vectors/clear", { method: "DELETE" });
                    void fetchStatus();
                } finally {
                    setIsActionLoading(false);
                    setConfirmDialog(null);
                }
            }
        });
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchError(null);
        try {
            const res = await fetch("/api/vectors/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: searchQuery,
                    maxResults: topK
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setSearchResults(data.results || []);
                if (data.results?.length === 0) {
                    setSearchError("No results found for this query.");
                }
            } else {
                setSearchError(data.error || "Search failed");
                setSearchResults([]);
            }
        } catch (error) {
            setSearchError("Failed to connect to search API.");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const getHealthColor = () => {
        if (healthStatus === 'success') return 'emerald';
        if (healthStatus === 'error') return 'rose';
        if (healthStatus === 'loading') return 'amber';
        return 'zinc';
    };

    const getHealthIcon = () => {
        if (healthStatus === 'loading') return Loader2;
        if (healthStatus === 'error') return AlertCircle;
        if (healthStatus === 'success') return CheckCircle2;
        return Settings; // Default
    };

    const isInitialLoad = isLoading && !status && !config;

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {!isLoading && loadError && !status && !config && (
                <div className="flex-1 overflow-y-auto p-6">
                    <ErrorState
                        message={loadError}
                        onRetry={() => void fetchData(true)}
                    />
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-success-bg text-status-success-text">
                        <Database className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Vector Index</h1>
                        <p className="text-sm text-text-muted">Code semantic indexing and vector store management</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Indicator replacing config button */}
                    {isInitialLoad ? (
                        <Skeleton className="h-8 w-48 rounded-md" />
                    ) : (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle ${healthStatus === 'error' ? 'bg-status-error-bg border-status-error-border' : 'bg-bg-elevated'
                            }`}>
                            <div className={`h-2 w-2 rounded-full ${healthStatus === 'success' ? 'bg-status-success' :
                                healthStatus === 'error' ? 'bg-status-error' :
                                    healthStatus === 'loading' ? 'bg-status-warning animate-pulse' : 'bg-zinc-500'
                                }`} />
                            <span className="text-xs text-text-secondary">
                                {config?.provider ? PROVIDER_DISPLAY_NAMES[config.provider] ?? "Unknown" : "Unknown"}
                            </span>
                            {config?.provider && (
                                <span className="text-xs text-text-muted border-l border-border-subtle pl-2">
                                    {config[config.provider]?.model}
                                </span>
                            )}
                        </div>
                    )}

                    <Button variant="secondary" size="sm" onClick={() => { void fetchData(true); recheckHealth(); }}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Status
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
                {loadError && (
                    <EmptyState
                        variant="error"
                        title="Unable to load vector data"
                        description={loadError}
                        action={{
                            label: "Retry",
                            onClick: () => void fetchData(true),
                        }}
                        secondaryAction={{
                            label: "Open Config",
                            onClick: () => window.location.assign("/app/config"),
                        }}
                        size="sm"
                    />
                )}
                {isInitialLoad ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </div>

                        <Panel className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-56" />
                                    <Skeleton className="h-4 w-72" />
                                </div>
                                <div className="flex gap-2">
                                    <Skeleton className="h-9 w-32 rounded-md" />
                                    <Skeleton className="h-9 w-32 rounded-md" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-full rounded-full" />
                            <Skeleton className="mt-3 h-3 w-1/2" />
                        </Panel>

                        <div className="flex flex-col gap-6 pb-6">
                            <Panel className="p-4 h-[600px]">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <div className="mt-4">
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div className="mt-6 space-y-3">
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            </Panel>

                            <Panel className="p-4 h-[300px]">
                                <div className="flex items-center gap-2 mb-4">
                                    <Skeleton className="h-4 w-40" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            </Panel>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatusCard
                                title="Active Provider"
                                value={config?.provider ? PROVIDER_DISPLAY_NAMES[config.provider] ?? "None" : "None"}
                                icon={getHealthIcon()}
                                subtitle={
                                    healthStatus === 'error' ? (healthMessage || "Connection failed") :
                                        healthStatus === 'success' ? (healthMessage || "Online") :
                                            healthStatus === 'loading' ? "Checking connection..." :
                                                (config?.provider ? (config[config.provider]?.model || "Unknown model") : "Configure provider")
                                }
                                color={healthStatus === 'success' ? 'emerald' : healthStatus === 'error' ? 'rose' : healthStatus === 'loading' ? 'amber' : 'zinc'}
                                isAnimated={healthStatus === 'loading'}
                            />
                            <StatusCard
                                title="Index Status"
                                value={
                                    status?.isIndexing
                                        ? "Indexing..."
                                        : totalFiles === 0
                                            ? "Not Indexed"
                                            : isPartial
                                                ? "Partial"
                                                : "Indexed"
                                }
                                icon={status?.isIndexing ? RefreshCw : CheckCircle2}
                                subtitle={
                                    status?.isIndexing
                                        ? `Processing ${indexedFiles} / ${totalFiles}`
                                        : totalFiles > 0
                                            ? isPartial
                                                ? `Indexed ${indexedFiles} / ${totalFiles} • Remaining ${remainingFiles} (${remainingPercent}%)`
                                                : `Indexed ${indexedFiles} / ${totalFiles} • Last update: ${status?.lastIndexedAt ? new Date(status.lastIndexedAt).toLocaleTimeString() : "—"}`
                                            : "Ready to index"
                                }
                                color={status?.isIndexing ? "sky" : totalFiles > 0 && !isPartial ? "emerald" : "zinc"}
                                isAnimated={status?.isIndexing}
                            />
                            <StatusCard
                                title="Indexed Files"
                                value={`${indexedFiles} / ${totalFiles}`}
                                icon={FileCode}
                                progress={totalFiles ? (indexedFiles / totalFiles) * 100 : 0}
                                color="zinc"
                            />
                            <Link href="/app/vectors/history" className="block h-full">
                                <StatusCard
                                    title="Run History"
                                    value="View Log"
                                    icon={Clock}
                                    subtitle="Review past indexing runs"
                                    color="amber"
                                    className="h-full hover:bg-bg-elevated cursor-pointer"
                                />
                            </Link>
                        </div>

                        {/* Actions Panel */}
                        <Panel className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-base font-semibold text-text-primary">Indexing Operations</h2>
                                    <p className="text-sm text-text-muted mt-1">Manage semantic indexing of your repository</p>
                                </div>
                                <div className="flex gap-2">
                                    {isPartial && (
                                        <Button
                                            className="bg-status-success hover:bg-status-success text-white"
                                            onClick={() => void handleContinueIndexing()}
                                            disabled={status?.isIndexing || isActionLoading}
                                        >
                                            <Play className="mr-2 h-4 w-4 fill-current" />
                                            Continue Indexing
                                        </Button>
                                    )}
                                    {status?.totalChunks ? (
                                        <>
                                            <Button
                                                variant="secondary"
                                                onClick={() => void handleStartIndexing(true)}
                                                disabled={status.isIndexing || isActionLoading}
                                            >
                                                <RefreshCw className={`mr-2 h-4 w-4 ${status.isIndexing ? 'animate-spin' : ''}`} />
                                                Full Reindex
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                className="text-status-error-text hover:text-status-error-text hover:bg-status-error-bg"
                                                onClick={() => void handleClearIndex()}
                                                disabled={status.isIndexing || isActionLoading}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Clear Vectors
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            className="bg-status-success hover:bg-status-success text-white"
                                            onClick={() => void handleStartIndexing()}
                                            disabled={status?.isIndexing || isActionLoading}
                                        >
                                            <Play className="mr-2 h-4 w-4 fill-current" />
                                            Start Initial Indexing
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {status?.isIndexing && (
                                <div className="space-y-2 mt-4">
                                    <div className="flex justify-between text-xs text-text-secondary">
                                        <span>Processing repository...</span>
                                        <span>{progressPercent}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-bg-app rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-status-success transition-all duration-500"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] font-mono text-text-muted truncate">
                                        Current: {status.currentFile}
                                    </p>
                                </div>
                            )}
                        </Panel>

                        {/* Search Preview */}
                        <div className="flex flex-col gap-6 pb-6">
                            <div className="flex flex-col h-[600px] overflow-hidden rounded-lg border border-border-subtle bg-bg-surface shadow-sm">
                                <div className="p-4 border-b border-border-subtle bg-bg-surface flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4 text-text-muted" />
                                        <h2 className="text-sm font-semibold text-text-primary">Semantic Search Preview</h2>
                                    </div>
                                    {searchResults.length > 0 && (
                                        <span className="text-[10px] text-text-muted">{searchResults.length} results found</span>
                                    )}
                                </div>
                                <div className="p-4 bg-bg-surface border-b border-border-subtle">
                                    <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Enter natural language query (e.g. 'auth logic')"
                                            className="flex-1 rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary outline-none focus:border-status-success-border"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <div className="flex items-center gap-2 px-2 border-l border-border-subtle">
                                            <span className="text-[10px] text-text-muted font-bold uppercase whitespace-nowrap">Top K:</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="50"
                                                value={topK}
                                                onChange={(e) => setTopK(parseInt(e.target.value) || 1)}
                                                className="w-12 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus:border-status-success-border"
                                            />
                                        </div>
                                        <Button type="submit" size="sm" disabled={isSearching || !status?.totalChunks}>
                                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                                        </Button>
                                    </form>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-elegant bg-bg-app/20 min-h-0">
                                    {searchError && (
                                        <div className="p-4 rounded-lg bg-status-error-bg border border-status-error-border text-status-error-text flex items-start gap-3">
                                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                            <div className="text-xs">
                                                <p className="font-semibold mb-1">Search Error</p>
                                                <p>{searchError}</p>
                                            </div>
                                        </div>
                                    )}
                                    {searchResults.length === 0 && !isSearching && !searchError && (
                                        <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50">
                                            <Search className="h-10 w-10 mb-2" />
                                            <p className="text-xs italic">Enter a query to test the vector search</p>
                                        </div>
                                    )}
                                    {searchResults.map((result, idx) => (
                                        <div key={idx} className="group rounded-lg border border-border-subtle bg-bg-elevated/40 p-4 hover:border-status-success-border transition shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <FileCode className="h-4 w-4 text-status-info-text" />
                                                    <span className="text-xs font-mono text-text-primary truncate">{result.filePath}:{result.startLine}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-24 bg-bg-app rounded-full overflow-hidden mr-1">
                                                        <div
                                                            className="h-full bg-status-success"
                                                            style={{ width: `${result.score * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-status-success-text">{(result.score * 100).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                            <pre className="text-xs leading-relaxed text-text-secondary bg-bg-app p-3 rounded border border-border-subtle overflow-auto whitespace-pre font-mono max-h-[400px]">
                                                {result.content}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Errors / Logs */}
                            <div className="flex flex-col h-[300px] overflow-hidden rounded-lg border border-border-subtle bg-bg-surface shadow-sm">
                                <div className="p-4 border-b border-border-subtle bg-bg-surface flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-text-muted" />
                                    <h2 className="text-sm font-semibold text-text-primary">Indexing Logs</h2>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 font-mono scrollbar-elegant bg-bg-app/40 min-h-0">
                                    {!status?.errors?.length && (
                                        <div className="p-4 text-xs text-text-muted italic">No errors reported</div>
                                    )}
                                    {status?.errors.map((error, idx) => (
                                        <div key={idx} className="p-2 border-b border-border-subtle last:border-0 hover:bg-white/5 transition">
                                            <p className="text-xs text-status-error-text leading-normal">{error}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Confirmation Modal */}
            <Modal
                open={!!confirmDialog}
                onClose={() => setConfirmDialog(null)}
                title={confirmDialog?.title}
                subtitle="Action required"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setConfirmDialog(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            className={confirmDialog?.title === "Clear Vectors" ? "bg-status-error hover:bg-status-error" : ""}
                            onClick={() => confirmDialog?.action()}
                        >
                            Confirm
                        </Button>
                    </div>
                }
            >
                <div className="py-4">
                    <p className="text-sm text-text-secondary">{confirmDialog?.message}</p>
                </div>
            </Modal>
        </div>
    );
}

function StatusCard({ title, value, icon: Icon, subtitle, progress, color, isAnimated, className }: any) {
    const colors: any = {
        emerald: "text-status-success-text bg-status-success-bg",
        sky: "text-zinc-400 bg-zinc-400/10",
        indigo: "text-zinc-400 bg-zinc-400/10",
        amber: "text-zinc-400 bg-zinc-400/10",
        blue: "text-status-info-text bg-status-info-bg",
        zinc: "text-text-muted bg-bg-elevated"
    };

    return (
        <Panel className={`p-4 flex flex-col gap-3 relative overflow-hidden group hover:border-border-strong transition ${className || ''}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-text-primary">{value}</h3>
                </div>
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    <Icon className={`h-5 w-5 ${isAnimated ? 'animate-spin' : ''}`} />
                </div>
            </div>
            {subtitle && <p className="text-[11px] text-text-secondary truncate">{subtitle}</p>}
            {progress !== undefined && (
                <div className="mt-1 h-1 w-full bg-bg-app rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
            )}
        </Panel>
    );
}

function SkeletonCard() {
    return (
        <Panel className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-20" />
                </div>
                <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-1 w-full rounded-full" />
        </Panel>
    );
}
