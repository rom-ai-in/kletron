"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChainCard } from "@/src/components/ChainCard";
import { Button } from "@/src/components/ui/Button";
import { Panel } from "@/src/components/ui/Panel";
import { ChainBuilderModal } from "@/src/components/ChainBuilderModal";
import type { AuditChain } from "@/src/services/chainTypes";
import { Search, Layers } from "lucide-react";

type FilterStatus = "all" | "running" | "completed";

export default function ChainsPage() {
    const router = useRouter();
    const [chains, setChains] = useState<AuditChain[]>([]);
    const [filter, setFilter] = useState<FilterStatus>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [editChainId, setEditChainId] = useState<string | undefined>(undefined);

    useEffect(() => {
        void fetchChains();
    }, []);

    const fetchChains = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/campaigns");
            if (!res.ok) throw new Error("Failed to load chains");
            const data = await res.json();
            setChains(data.chains || []);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const filteredChains = chains.filter((chain) => {
        if (filter === "running" && chain.status !== "RUNNING") return false;
        if (filter === "completed" && chain.status !== "COMPLETED") return false;
        if (
            searchQuery &&
            !chain.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !chain.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
            return false;
        }
        return true;
    });

    const handleCreateChain = () => {
        setEditChainId(undefined);
        setIsBuilderOpen(true);
    };

    const handleEditChain = (chainId: string) => {
        setEditChainId(chainId);
        setIsBuilderOpen(true);
    };

    const handleChainCreated = (chainId: string) => {
        setIsBuilderOpen(false);
        if (editChainId) {
            void fetchChains(); // Refresh list if edited
        } else {
            router.push(`/campaigns/${chainId}`);
        }
    };

    const handleViewChain = (chainId: string) => {
        router.push(`/campaigns/${chainId}`);
    };

    const handleDeleteChain = async (chainId: string) => {
        try {
            const res = await fetch(`/api/campaigns/${chainId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete campaign");
            }
            void fetchChains();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="flex h-full flex-col">
            <ChainBuilderModal
                open={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                onCreated={handleChainCreated}
                editChainId={editChainId}
            />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <Layers className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Audit Campaigns</h1>
                        <p className="text-sm text-text-muted">Orchestrate and monitor multi-stage audit pipelines</p>
                    </div>
                </div>
                <Button onClick={handleCreateChain}>+ New Campaign</Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated pl-10 pr-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring"
                    />
                </div>
                <div className="flex gap-2">
                    <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                        All
                    </FilterButton>
                    <FilterButton active={filter === "running"} onClick={() => setFilter("running")}>
                        Running
                    </FilterButton>
                    <FilterButton active={filter === "completed"} onClick={() => setFilter("completed")}>
                        Completed
                    </FilterButton>
                </div>
            </div>

            {/* Chain List */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" />
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
                        Error: {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="space-y-4">
                        {filteredChains.map((chain) => (
                            <ChainCard
                                key={chain._id?.toString()}
                                chain={chain}
                                onView={() => void handleViewChain(chain._id!.toString())}
                                onEdit={() => void handleEditChain(chain._id!.toString())}
                                onDelete={() => void handleDeleteChain(chain._id!.toString())}
                            />
                        ))}
                        {filteredChains.length === 0 && (
                            <EmptyState
                                message={searchQuery ? "No campaigns match your search" : "No campaigns found"}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${active
                ? "bg-state-selected text-text-primary"
                : "text-text-muted hover:bg-state-hover hover:text-text-secondary"
                }`}
        >
            {children}
        </button>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <Panel className="flex h-64 items-center justify-center">
            <div className="text-center">
                <p className="text-sm text-text-muted">{message}</p>
                <p className="mt-2 text-xs text-text-muted">
                    Try adjusting your filters or create a new audit campaign
                </p>
            </div>
        </Panel>
    );
}
