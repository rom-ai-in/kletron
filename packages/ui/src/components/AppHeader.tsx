"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, History, PanelLeft, PanelLeftClose } from "lucide-react";
import { Breadcrumbs, Selector, type SelectorOption } from "@kletron/ui/components/design-system";
import { useWorkspace } from "../context/WorkspaceContext";
import { useOptionalAppHeaderCenter } from "./AppHeaderCenterSlot";

export interface AppHeaderProps {
  /** Show/hide the app rail. Omit to hide the control (e.g. rail-less surfaces). */
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

export function AppHeader({ onToggleSidebar, sidebarCollapsed = false }: AppHeaderProps = {}) {
  const headerCenter = useOptionalAppHeaderCenter();
  const {
    workspaces,
    activeWorkspaceId,
    loading: workspaceLoading,
    hasWorkspaceHealthIssues: _hasWorkspaceHealthIssues,
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
        hasWarning: workspace.health && workspace.health !== "healthy",
      };
    });
  }, [workspaces]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === "none" || workspaceId === activeWorkspaceId) return;
    await switchWorkspace(workspaceId);
  };

  return (
    <header className="border-b border-white/[0.06] bg-bg-surface">
      {/* Fixed row height so bottom border lines up with Sidebar brand row (content height varies otherwise) */}
      <div className="flex h-14 shrink-0 items-center gap-4 px-6 min-w-0">
        {/* Panel toggle sits at the content edge, not inside the rail: it must
            stay reachable and legible once the rail is a 72px strip. */}
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="-ml-2 flex shrink-0 items-center justify-center rounded-md p-1.5 text-text-muted transition-colors hover:bg-state-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar  ⌘B`}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        ) : null}
        <div className="flex shrink-0 min-w-0">
          <Breadcrumbs />
        </div>
        <div className="flex flex-1 justify-center min-w-0 px-2">
          {headerCenter?.centerContent}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <Selector
              label="Workspace"
              value={activeWorkspaceId || "none"}
              options={workspaceOptions}
              onSelect={handleSelectWorkspace}
              size="sm"
              direction="down"
              loading={workspaceLoading}
            />
            <Link
              href="/app/config/workspace"
              className="flex items-center justify-center rounded-md border border-white/[0.08] p-1.5 text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors"
              title="Manage workspaces"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Link
            href="/app/history"
            className="flex items-center gap-2 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors"
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
