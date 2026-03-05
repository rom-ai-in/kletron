"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, History } from "lucide-react";
import { Breadcrumbs, Selector, type SelectorOption } from "@numezis/ui/components/design-system";
import { useWorkspace } from "../context/WorkspaceContext";

export function AppHeader() {
  const {
    workspaces,
    activeWorkspaceId,
    loading: workspaceLoading,
    hasWorkspaceHealthIssues,
    switchWorkspace,
  } = useWorkspace();

  const workspaceOptions = useMemo<SelectorOption[]>(() => {
    if (!workspaces.length) {
      return [{ id: "none", label: "No workspace", sub: "Add one in settings" }];
    }
    return workspaces.map((workspace) => {
      const fallbackName = workspace.rootPath?.split("/").filter(Boolean).pop() || "Workspace";
      return {
        id: workspace.id,
        label: workspace.name || fallbackName,
        sub:
          workspace.health && workspace.health !== "healthy"
            ? `${workspace.rootPath} (${workspace.health})`
            : workspace.rootPath,
      };
    });
  }, [workspaces]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === "none" || workspaceId === activeWorkspaceId) return;
    await switchWorkspace(workspaceId);
  };

  return (
    <header className="border-b border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <Breadcrumbs />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Selector
              label="Workspace"
              value={activeWorkspaceId || workspaceOptions[0]?.id || "none"}
              options={workspaceOptions}
              onSelect={handleSelectWorkspace}
              size="sm"
              direction="down"
              loading={workspaceLoading}
            />
            <Link
              href="/app/config/workspace"
              className="flex items-center justify-center rounded-md border border-border-subtle p-1.5 text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors"
              title="Manage workspaces"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
            {hasWorkspaceHealthIssues && (
              <span className="rounded-md border border-status-warning-border bg-status-warning-bg px-2 py-1 text-[10px] font-semibold text-status-warning-text">
                Workspace attention needed
              </span>
            )}
          </div>
          <Link
            href="/app/history"
            className="flex items-center gap-2 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors"
            title="History"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Link>
        </div>
      </div>
    </header>
  );
}
