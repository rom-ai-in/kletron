"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
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
    Layers,
    FileCode,
    ChevronRight,
    Play
} from "lucide-react";
import { Modal } from "@/src/components/ui/Modal";
import { AzureEmbeddingConfigForm, LMStudioEmbeddingConfigForm } from "@/src/components/EmbeddingConfigForms";

type IndexStatus = {
    isIndexing: boolean;
    totalFiles: number;
    indexedFiles: number;
    totalChunks: number;
    lastIndexedAt?: string;
    currentFile?: string;
    errors: string[];
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
    const [status, setStatus] = useState<IndexStatus | null>(null);
    const [config, setConfig] = useState<any>(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
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

    // Fetch initial data
    const fetchData = useCallback(async () => {
        try {
            const [statusRes, configRes] = await Promise.all([
                fetch("/api/vectors"),
                fetch("/api/embedding-config")
            ]);
            if (statusRes.ok) setStatus(await statusRes.json());
            if (configRes.ok) setConfig(await configRes.json());
        } catch (error) {
            console.error("Failed to fetch vector data", error);
        }
    }, []);

    useEffect(() => {
        void fetchData();
        const interval = setInterval(() => {
            if (status?.isIndexing) void fetchStatus();
        }, 2000);
        return () => clearInterval(interval);
    }, [fetchData, status?.isIndexing]);

    const fetchStatus = async () => {
        const res = await fetch("/api/vectors");
        if (res.ok) setStatus(await res.json());
    };

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

        // For initial indexing, we can also add a confirmation if we want, 
        // but it's less "destructive" than a full reindex on an existing index.
        // Let's keep it simple for now as requested for "Full Reindex".
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
                body: JSON.stringify({ query: searchQuery }),
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

    const handleSaveConfig = async (provider: string, data: any) => {
        const res = await fetch(`/api/embedding-config/${provider}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            void fetchData();
            setIsConfigModalOpen(false);
        } else {
            const err = await res.json();
            throw new Error(err.error || "Failed to save config");
        }
    };

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Database className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Vector Index</h1>
                        <p className="text-sm text-text-muted">Code semantic indexing and vector store management</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setIsConfigModalOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Configure Embedding
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void fetchData()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Status
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatusCard
                        title="Active Provider"
                        value={config?.provider === 'azure' ? "Azure OpenAI" : config?.provider === 'lmstudio' ? "LM Studio" : "None"}
                        icon={Settings}
                        subtitle={config?.provider ? (config[config.provider]?.model || "Unknown model") : "Configure provider"}
                        color="blue"
                    />
                    <StatusCard
                        title="Index Status"
                        value={status?.isIndexing ? "Indexing..." : status?.totalChunks ? "Indexed" : "Not Indexed"}
                        icon={status?.isIndexing ? RefreshCw : CheckCircle2}
                        subtitle={status?.isIndexing ? `Processing...` : status?.lastIndexedAt ? `Last update: ${new Date(status.lastIndexedAt).toLocaleTimeString()}` : "Ready to index"}
                        color={status?.isIndexing ? "sky" : status?.totalChunks ? "emerald" : "zinc"}
                        isAnimated={status?.isIndexing}
                    />
                    <StatusCard
                        title="Indexed Files"
                        value={`${status?.indexedFiles ?? 0} / ${status?.totalFiles ?? 0}`}
                        icon={FileCode}
                        progress={status?.totalFiles ? (status.indexedFiles / status.totalFiles) * 100 : 0}
                        color="indigo"
                    />
                    <Link href="/vectors/history" className="block h-full">
                        <StatusCard
                            title="Run History"
                            value="View Log"
                            icon={Clock}
                            subtitle="Audit past indexing runs"
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
                                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                        onClick={() => void handleClearIndex()}
                                        disabled={status.isIndexing || isActionLoading}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Clear Vectors
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
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
                                <span>{Math.round((status.indexedFiles / status.totalFiles) * 100)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-bg-app rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-500"
                                    style={{ width: `${(status.indexedFiles / status.totalFiles) * 100}%` }}
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
                    <Panel className="p-0 flex flex-col h-[600px]">
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
                                    className="flex-1 rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary outline-none focus:border-emerald-500/50"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Button type="submit" size="sm" disabled={isSearching || !status?.totalChunks}>
                                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                                </Button>
                            </form>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-elegant bg-bg-app/20">
                            {searchError && (
                                <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
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
                                <div key={idx} className="group rounded-lg border border-border-subtle bg-bg-elevated/40 p-4 hover:border-emerald-500/30 transition shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <FileCode className="h-4 w-4 text-sky-400" />
                                            <span className="text-xs font-mono text-text-primary truncate">{result.filePath}:{result.startLine}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-24 bg-bg-app rounded-full overflow-hidden mr-1">
                                                <div
                                                    className="h-full bg-emerald-500"
                                                    style={{ width: `${result.score * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-emerald-400">{(result.score * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <pre className="text-xs leading-relaxed text-text-secondary bg-bg-app p-3 rounded border border-border-subtle overflow-x-auto whitespace-pre font-mono">
                                        {result.content}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    {/* Errors / Logs */}
                    <Panel className="p-0 flex flex-col h-[300px]">
                        <div className="p-4 border-b border-border-subtle bg-bg-surface flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-text-muted" />
                            <h2 className="text-sm font-semibold text-text-primary">Indexing Logs</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 font-mono scrollbar-elegant bg-bg-app/40">
                            {!status?.errors?.length && (
                                <div className="p-4 text-xs text-text-muted italic">No errors reported</div>
                            )}
                            {status?.errors.map((error, idx) => (
                                <div key={idx} className="p-2 border-b border-border-subtle last:border-0 hover:bg-white/5 transition">
                                    <p className="text-xs text-rose-400 leading-normal">{error}</p>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>

            {/* Config Modal */}
            <Modal
                open={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                title="Embedding Configuration"
                subtitle="Select and configure your embedding provider"
            >
                <div className="space-y-6">
                    <div className="flex p-1 bg-bg-app rounded-lg border border-border-subtle">
                        <button
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${config?.provider === 'azure' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                            onClick={() => setConfig({ ...config, provider: 'azure' })}
                        >
                            Azure OpenAI
                        </button>
                        <button
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${config?.provider === 'lmstudio' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                            onClick={() => setConfig({ ...config, provider: 'lmstudio' })}
                        >
                            LM Studio
                        </button>
                    </div>

                    {config ? (
                        config.provider === 'azure' ? (
                            <AzureEmbeddingConfigForm
                                initialConfig={config.azure}
                                onSave={(data) => handleSaveConfig('azure', data)}
                                onCancel={() => setIsConfigModalOpen(false)}
                            />
                        ) : (
                            <LMStudioEmbeddingConfigForm
                                initialConfig={config.lmstudio}
                                onSave={(data) => handleSaveConfig('lmstudio', data)}
                                onCancel={() => setIsConfigModalOpen(false)}
                            />
                        )
                    ) : (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                        </div>
                    )}
                </div>
            </Modal>

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
                            className={confirmDialog?.title === "Clear Vectors" ? "bg-rose-600 hover:bg-rose-500" : ""}
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
        emerald: "text-emerald-500 bg-emerald-500/10",
        sky: "text-sky-500 bg-sky-500/10",
        indigo: "text-indigo-400 bg-indigo-400/10",
        amber: "text-amber-400 bg-amber-400/10",
        blue: "text-blue-400 bg-blue-400/10",
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
                    <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
            )}
        </Panel>
    );
}
