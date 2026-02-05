"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Breadcrumbs, Selector, type SelectorOption } from "@numezis/ui/components/design-system";

type WorkspaceSummary = {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  status?: string;
};

export function AppHeader() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchWorkspaces = async () => {
      setWorkspaceLoading(true);
      try {
        const res = await fetch("/api/workspaces");
        if (!res.ok) {
          throw new Error("Failed to load workspaces");
        }
        const data = await res.json();
        const list = Array.isArray(data.workspaces) ? data.workspaces : [];
        setWorkspaces(list);
        setActiveWorkspaceId(data.activeWorkspaceId ?? list[0]?.id ?? "");
      } catch (e) {
        console.error("Failed to fetch workspaces", e);
      } finally {
        setWorkspaceLoading(false);
      }
    };

    void fetchWorkspaces();
  }, []);

  const workspaceOptions = useMemo<SelectorOption[]>(() => {
    if (!workspaces.length) {
      return [{ id: "none", label: "No workspace", sub: "Add one in settings" }];
    }
    return workspaces.map((workspace) => {
      const fallbackName = workspace.rootPath?.split("/").filter(Boolean).pop() || "Workspace";
      return {
        id: workspace.id,
        label: workspace.name || fallbackName,
        sub: workspace.rootPath,
      };
    });
  }, [workspaces]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === "none" || workspaceId === activeWorkspaceId) return;
    setWorkspaceLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/select`, { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to select workspace");
      }
      setActiveWorkspaceId(workspaceId);
      router.refresh();
    } catch (e) {
      console.error("Failed to select workspace", e);
    } finally {
      setWorkspaceLoading(false);
    }
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
          </div>
        </div>
      </div>
    </header>
  );
}
