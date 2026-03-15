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
    AlertCircle,
    Timer,
    Webhook,
    GitBranch,
    Hand,
} from "lucide-react";
import { Button } from "@numezis/ui/components/design-system";
import { AutomationBuilderModal } from "../AutomationBuilderModal";
import type { AutomationDefinition, AutomationTriggerType } from "@numezis/shared/automationTypes";
import { cn } from "@numezis/shared/utils/cn";
import { useWorkspace } from "@numezis/ui/context/WorkspaceContext";

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

export function AutomationListSidebar() {
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const activeId = params?.id as string;
    const { activeWorkspaceId } = useWorkspace() ?? {};

    // State
    const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "running" | "completed">("all");
    const [triggerFilter, setTriggerFilter] = useState<"all" | AutomationTriggerType>("all");
    const [loading, setLoading] = useState(false);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    // Fetch automations
    const fetchAutomations = async () => {
        setLoading(true);
        setApiError(null);
        try {
            const headers: Record<string, string> = {};
            if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
            const res = await fetch("/api/automations", { headers });
            if (res.ok) {
                const data = await res.json();
                setAutomations(data.automations || data.chains || []);
            } else {
                const err = await res.json().catch(() => ({}));
                setApiError((err as Record<string, string>).message || (err as Record<string, string>).error || "Failed to load automations");
            }
        } catch (error) {
            console.error("Failed to fetch automations", error);
            setApiError("Failed to load automations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchAutomations();
        // Set up polling for active automations if needed, or just refresh on focus
        const interval = setInterval(() => {
            // Only poll if we have running automations or if window is focused
            if (document.hasFocus()) {
                void fetchAutomations();
            }
        }, 10000); // 10s polling
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkspaceId]);

    // Filter logic
    const filteredAutomations = automations.filter(automation => {
        const matchesSearch = automation.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter =
            filter === "all" ? true :
                filter === "running" ? automation.status === "RUNNING" :
                    filter === "completed" ? (automation.status === "COMPLETED" || automation.status === "FAILED") : true;
        const matchesTrigger = triggerFilter === "all" ? true : (automation.triggerType || "manual") === triggerFilter;
        return matchesSearch && matchesFilter && matchesTrigger;
    });

    const handleCreate = () => {
        setIsBuilderOpen(true);
    };

    const handleAutomationCreated = (id: string) => {
        setIsBuilderOpen(false);
        void fetchAutomations();
        router.push(`/app/automations/${id}`);
    };

    return (
        <div className="flex flex-col h-full w-[350px] border-r border-border-subtle bg-bg-surface overflow-hidden">
            {/* Header Area */}
            <div className="flex flex-col gap-3 p-3 border-b border-border-subtle bg-bg-surface/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-text-primary px-1">
                        <Layers className="h-4 w-4 text-text-muted" />
                        <span className="text-sm font-semibold tracking-tight">Automations</span>
                    </div>
                    <Button
                        size="icon"
                        className="h-8 w-8 bg-status-info hover:bg-status-info text-text-primary border-transparent"
                        onClick={handleCreate}
                        title="New Automation"
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
                {/* Trigger type filter */}
                <div className="flex border border-border-subtle rounded-md bg-bg-elevated p-0.5">
                    {([
                        { id: "all" as const, label: "All", Icon: Layers },
                        { id: "manual" as const, label: "Manual", Icon: Hand },
                        { id: "schedule" as const, label: "Scheduled", Icon: Timer },
                        { id: "webhook" as const, label: "Webhook", Icon: Webhook },
                        { id: "git_event" as const, label: "Git", Icon: GitBranch },
                    ] as const).map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTriggerFilter(id)}
                            className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[9px] font-medium hover:bg-state-hover transition-colors",
                                triggerFilter === id && "bg-state-selected shadow-sm"
                            )}
                            title={label}
                        >
                            <Icon className="h-2.5 w-2.5 text-text-muted" />
                            <span className="text-text-muted">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant">
                {apiError && (
                    <div className="mx-3 mt-3 rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-text">
                        {apiError}
                    </div>
                )}
                {loading && automations.length === 0 ? (
                    <div className="p-4 space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 w-full bg-bg-elevated/50 animate-pulse rounded-md" />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col py-1">
                        {filteredAutomations.map(automation => {
                            // Ensure ID comparison works (automation._id is ObjectId from standard, activeId is string from URL)
                            const automationIdStr = automation._id?.toString() || "";
                            const isActive = automationIdStr === activeId;
                            const isBlocked = automation.stages?.some((stage) => !stage.prompt || stage.prompt.trim() === "");
                            const status = isBlocked ? "BLOCKED" : automation.status;

                            return (
                                <button
                                    key={automationIdStr}
                                    onClick={() => router.push(`/app/automations/${automationIdStr}`)}
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
                                            {automation.name}
                                        </span>
                                        <StatusIcon status={status} />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                                        <span className="truncate max-w-[150px]">
                                            {automation.description || "No description"}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <SidebarTriggerIcon triggerType={automation.triggerType} />
                                            {automation.createdAt && (
                                                <span className="opacity-70">
                                                    {new Date(automation.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {filteredAutomations.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                                <Search className="h-6 w-6 mb-2 opacity-20" />
                                <span className="text-xs">No automations found</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <AutomationBuilderModal
                open={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                onCreated={handleAutomationCreated}
            />
        </div>
    );
}

function SidebarTriggerIcon({ triggerType }: { triggerType?: AutomationTriggerType }) {
    const trigger = triggerType || "manual";
    switch (trigger) {
        case "schedule":
            return <span title="Scheduled"><Timer className="h-2.5 w-2.5 text-status-info-text" /></span>;
        case "webhook":
            return <span title="Webhook"><Webhook className="h-2.5 w-2.5 text-status-warning-text" /></span>;
        case "git_event":
            return <span title="Git Event"><GitBranch className="h-2.5 w-2.5 text-status-success-text" /></span>;
        default:
            return null; // Manual doesn't show an icon
    }
}
