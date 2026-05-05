"use client";

import { useState } from "react";
import { Layers, Search, Plus, CheckCircle2, XCircle, Clock, Pause, Play } from "lucide-react";
import { Button, Skeleton } from "@kletron/ui/components/design-system";
import type { Automation, AutomationStatus } from "@kletron/ui/components/CommandCenter/AutomationsDashboard";
import { cn } from "@kletron/shared/utils/cn";

function StatusIcon({ status }: { status: AutomationStatus }) {
  switch (status) {
    case "active":
      return <Play className="h-3.5 w-3.5 text-status-success-text" />;
    case "paused":
      return <Pause className="h-3.5 w-3.5 text-text-muted" />;
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-status-success-text" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-status-error-text" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-text-muted" />;
  }
}

export type AutomationListPanelProps = {
  automations: Automation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  workspaceName?: string;
  workspaceRootHint?: string;
  onCreateClick: () => void;
  className?: string;
};

/**
 * Master list for desktop (and embeddable) automations: same information density as web
 * `AutomationListSidebar` without Next.js router or internal fetch.
 */
export function AutomationListPanel({
  automations,
  selectedId,
  onSelect,
  loading = false,
  error = null,
  workspaceName,
  workspaceRootHint,
  onCreateClick,
  className = "",
}: AutomationListPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = automations.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div
      className={cn(
        "flex flex-col h-full w-[min(100%,350px)] shrink-0 border-r border-border-subtle bg-bg-surface overflow-hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-3 border-b border-border-subtle bg-bg-surface/50">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5 text-text-primary px-1 min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-text-muted shrink-0" />
              <span className="text-sm font-semibold tracking-tight">Automations</span>
            </div>
            {workspaceName ? (
              <span className="text-[10px] text-text-muted truncate pl-6" title={workspaceRootHint}>
                Workspace: {workspaceName}
              </span>
            ) : null}
          </div>
          <Button
            size="icon"
            className="h-8 w-8 bg-status-info hover:bg-status-info text-text-primary border-transparent"
            onClick={onCreateClick}
            title="New automation"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted" />
          <input
            className="w-full bg-bg-elevated border border-border-subtle rounded-md pl-6 pr-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-focus-ring transition-all"
            placeholder="Find…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search automations"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-elegant">
        {error ? (
          <div className="mx-3 mt-3 rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-text">
            {error}
          </div>
        ) : null}
        {loading && automations.length === 0 ? (
          <div className="p-3 space-y-2" aria-busy="true" aria-label="Loading automations">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-md bg-bg-elevated/25 px-3 py-2.5 space-y-2 border-0">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="flex-1 max-w-[200px]" height="h-3.5" radius="rounded-md" />
                  <Skeleton className="w-3.5 shrink-0" height="h-3.5" radius="rounded-full" />
                </div>
                <Skeleton className="flex-1 max-w-[140px]" height="h-2.5" radius="rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col py-1">
            {filtered.map((automation) => {
              const isActive = automation.id === selectedId;
              return (
                <button
                  key={automation.id}
                  type="button"
                  onClick={() => onSelect(automation.id)}
                  className={cn(
                    "group flex flex-col gap-0.5 px-3 py-2 text-left transition-colors border-l-[3px] border-transparent hover:bg-state-hover/50",
                    isActive ? "bg-state-selected border-l-blue-500" : "text-text-secondary",
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={cn(
                        "text-[13px] font-medium truncate w-[200px]",
                        isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary",
                      )}
                    >
                      {automation.name}
                    </span>
                    <StatusIcon status={automation.status} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span className="truncate max-w-[150px]">{automation.description || "No description"}</span>
                    {automation.lastRunAt ? (
                      <span className="opacity-70">
                        {new Date(automation.lastRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                <Search className="h-6 w-6 mb-2 opacity-20" />
                <span className="text-xs">No automations found</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
