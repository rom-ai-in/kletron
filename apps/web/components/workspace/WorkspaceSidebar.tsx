import React from "react";
import { DEFAULT_WORK_CATEGORIES } from "@kletron/shared";
import type { WorkCategory } from "@kletron/agent-core";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";

interface WorkspaceSidebarProps {
  workspaceId: string;
  currentCategory: string;
  onCategorySelect: (categoryId: string) => void;
}

export const WorkspaceSidebar = ({ workspaceId, currentCategory, onCategorySelect }: WorkspaceSidebarProps) => {
  const categories: WorkCategory[] = DEFAULT_WORK_CATEGORIES;
  const mode = normalizeToWorkModeId(currentCategory);

  return (
    <div className="w-64 h-full bg-surface border-r border-subtle flex flex-col">
      <div className="p-4 border-b border-subtle">
        <h2 className="font-semibold text-lg text-foreground">Workspace</h2>
        <p className="text-sm text-subtle truncate" title={workspaceId}>
          {workspaceId}
        </p>
      </div>

      <div className="p-4 border-b border-subtle">
        <h3 className="text-sm font-medium text-subtle uppercase tracking-wider mb-3">Mode</h3>
        <nav className="space-y-1">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                mode === category.id ? "bg-primary/10 font-medium" : "hover:bg-surface"
              }`}
            >
              <span className="text-xl" style={{ color: category.color }}>
                {category.icon}
              </span>
              <div>
                <div className="font-medium text-foreground">{category.name}</div>
                <div className="text-xs text-subtle">{category.description}</div>
              </div>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {mode === "code" && <CodeModeSidebarContent workspaceId={workspaceId} />}
        {mode === "work" && <WorkModeSidebarContent workspaceId={workspaceId} />}
      </div>
    </div>
  );
};

const CodeModeSidebarContent = ({ workspaceId }: { workspaceId: string }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-subtle uppercase tracking-wider">Code</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
          <span>📁</span>
          <span>File Explorer</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
          <span>🔍</span>
          <span>Search Code</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
          <span>⚙️</span>
          <span>Configuration</span>
        </div>
      </div>
    </div>
  );
};

const WorkModeSidebarContent = ({ workspaceId }: { workspaceId: string }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-subtle uppercase tracking-wider">Work</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
          <span>📄</span>
          <span>Documents & writing</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
          <span>🔍</span>
          <span>Web research</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
          <span>📅</span>
          <span>Planning</span>
        </div>
      </div>
    </div>
  );
};
