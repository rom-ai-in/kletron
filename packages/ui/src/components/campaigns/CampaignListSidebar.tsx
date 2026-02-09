"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import {
    Layers,
    Search,
    Plus,
    Play,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle
} from "lucide-react";
import { Button } from "@numezis/ui/components/design-system";
import { ChainBuilderModal } from "@numezis/ui/components/ChainBuilderModal";
import type { AuditChain } from "@numezis/shared/chainTypes";
import { cn } from "@numezis/shared/utils/cn";

// Helper for status icons
const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case "BLOCKED":
            return <AlertCircle className="h-3.5 w-3.5 text-status-warning-text" />;
        case "RUNNING":
            return <Play className="h-3.5 w-3.5 text-status-info-text animate-pulse" />;
        case "COMPLETED":
            return <CheckCircle2 className="h-3.5 w-3.5 text-status-success-text" />;
        case "FAILED":
            return <XCircle className="h-3.5 w-3.5 text-status-error-text" />;
        case "PENDING":
        default:
            return <Clock className="h-3.5 w-3.5 text-text-muted" />;
    }
};

export function CampaignListSidebar() {
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const activeId = params?.id as string;

    // State
    const [chains, setChains] = useState<AuditChain[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "running" | "completed">("all");
    const [loading, setLoading] = useState(false);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);

    // Fetch chains
    const fetchChains = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/campaigns");
            if (res.ok) {
                const data = await res.json();
                setChains(data.chains || []);
            }
        } catch (error) {
            console.error("Failed to fetch campaigns", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchChains();
        // Set up polling for active chains if needed, or just refresh on focus
        const interval = setInterval(() => {
            // Only poll if we have running chains or if window is focused
            if (document.hasFocus()) {
                void fetchChains();
            }
        }, 10000); // 10s polling
        return () => clearInterval(interval);
    }, []);

    // Filter logic
    const filteredChains = chains.filter(chain => {
        const matchesSearch = chain.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter =
            filter === "all" ? true :
                filter === "running" ? chain.status === "RUNNING" :
                    filter === "completed" ? (chain.status === "COMPLETED" || chain.status === "FAILED") : true;
        return matchesSearch && matchesFilter;
    });

    const handleCreate = () => {
        setIsBuilderOpen(true);
    };

    const handleChainCreated = (id: string) => {
        setIsBuilderOpen(false);
        void fetchChains();
        router.push(`/app/campaigns/${id}`);
    };

    return (
        <div className="flex flex-col h-full w-[350px] border-r border-border-subtle bg-bg-surface overflow-hidden">
            {/* Header Area */}
            <div className="flex flex-col gap-3 p-3 border-b border-border-subtle bg-bg-surface/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-text-primary px-1">
                        <Layers className="h-4 w-4 text-text-muted" />
                        <span className="text-sm font-semibold tracking-tight">Campaigns</span>
                    </div>
                    <Button
                        size="icon"
                        className="h-8 w-8 bg-status-info hover:bg-status-info text-text-primary border-transparent"
                        onClick={handleCreate}
                        title="New Campaign"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                {/* Search & Filter */}
                <div className="flex gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted" />
                        <input
                            className="w-full bg-bg-elevated border border-border-subtle rounded-md pl-6 pr-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-focus-ring transition-all"
                            placeholder="Find..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Tiny segmented control for status */}
                    <div className="flex border border-border-subtle rounded-md bg-bg-elevated p-0.5">
                        <button
                            onClick={() => setFilter("all")}
                            className={cn(
                                "p-1 rounded-[2px] hover:bg-state-hover transition-colors",
                                filter === "all" && "bg-state-selected shadow-sm"
                            )}
                            title="All"
                        >
                            <Layers className="h-3 w-3 text-text-muted" />
                        </button>
                        <button
                            onClick={() => setFilter("running")}
                            className={cn(
                                "p-1 rounded-[2px] hover:bg-state-hover transition-colors",
                                filter === "running" && "bg-state-selected shadow-sm"
                            )}
                            title="Running"
                        >
                            <Play className="h-3 w-3 text-status-info-text" />
                        </button>
                        <button
                            onClick={() => setFilter("completed")}
                            className={cn(
                                "p-1 rounded-[2px] hover:bg-state-hover transition-colors",
                                filter === "completed" && "bg-state-selected shadow-sm"
                            )}
                            title="Completed"
                        >
                            <CheckCircle2 className="h-3 w-3 text-status-success-text" />
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant">
                {loading && chains.length === 0 ? (
                    <div className="p-4 space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 w-full bg-bg-elevated/50 animate-pulse rounded-md" />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col py-1">
                        {filteredChains.map(chain => {
                            // Ensure ID comparison works (chain._id is ObjectId from standard, activeId is string from URL)
                            const chainIdStr = chain._id?.toString() || "";
                            const isActive = chainIdStr === activeId;
                            const isBlocked = chain.stages?.some((stage) => !stage.prompt || stage.prompt.trim() === "");
                            const status = isBlocked ? "BLOCKED" : chain.status;

                            return (
                                <button
                                    key={chainIdStr}
                                    onClick={() => router.push(`/app/campaigns/${chainIdStr}`)}
                                    className={cn(
                                        "group flex flex-col gap-0.5 px-3 py-2 text-left transition-colors border-l-[3px] border-transparent hover:bg-state-hover/50",
                                        isActive
                                            ? "bg-state-selected border-l-blue-500"
                                            : "text-text-secondary"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className={cn(
                                            "text-[13px] font-medium truncate w-[200px]",
                                            isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
                                        )}>
                                            {chain.name}
                                        </span>
                                        <StatusIcon status={status} />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                                        <span className="truncate max-w-[180px]">
                                            {chain.description || "No description"}
                                        </span>
                                        {chain.createdAt && (
                                            <span className="opacity-70">
                                                {new Date(chain.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}

                        {filteredChains.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                                <Search className="h-6 w-6 mb-2 opacity-20" />
                                <span className="text-xs">No campaigns found</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <ChainBuilderModal
                open={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                onCreated={handleChainCreated}
            />
        </div>
    );
}
