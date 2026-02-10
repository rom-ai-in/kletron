'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Settings,
  ChevronDown,
  ChevronRight,
  Pencil,
  Archive,
  Trash2,
  Check,
  X,
  FolderGit,
  FolderPlus,
  MoreHorizontal,
  SquarePen,
  ClipboardCheck,
} from 'lucide-react';

export type ThreadLiveStatus = 'running' | 'completed' | 'idle' | 'waiting' | 'error';

export interface SidebarThread {
  id: string;
  title: string;
  updatedAt?: string;
  liveStatus: ThreadLiveStatus;
}

export interface SidebarProject {
  id: string;
  name: string;
  threads: SidebarThread[];
}

export interface ProjectSidebarProps {
  projects: SidebarProject[];
  activeThreadId?: string | null;
  activeProjectId?: string | null;
  onThreadSelect?: (threadId: string) => void;
  /** Create a new thread inside a specific project */
  onNewThreadInProject?: (projectId: string) => void;
  /** Add a new project via folder picker */
  onAddProject?: () => void;
  onSettings?: () => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  /** Remove a project from the sidebar */
  onRemoveProject?: (projectId: string) => void;
  /** Items awaiting review */
  reviewQueueCount?: number;
  onReviewQueueClick?: () => void;
  className?: string;
}

function StatusDot({ status }: { status: ThreadLiveStatus }) {
  if (status === 'idle') return null;
  const styles: Record<ThreadLiveStatus, string> = {
    running: 'bg-status-success animate-pulse',
    completed: 'bg-status-success',
    idle: '',
    waiting: 'bg-status-warning',
    error: 'bg-status-error',
  };
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles[status]}`} />;
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (diffHours < 48) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ProjectSidebar({
  projects,
  activeThreadId,
  activeProjectId,
  onThreadSelect,
  onNewThreadInProject,
  onAddProject,
  onSettings,
  onRenameThread,
  onArchiveThread,
  onDeleteThread,
  onRemoveProject,
  reviewQueueCount = 0,
  onReviewQueueClick,
  className = '',
}: ProjectSidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [contextMenuProjectId, setContextMenuProjectId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Close context menu on scroll or outside click
  const closeContextMenu = useCallback(() => {
    setContextMenuProjectId(null);
    setMenuPosition(null);
  }, []);

  function toggleProject(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function startEdit(thread: SidebarThread) {
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title || '');
  }

  function saveEdit() {
    if (editingThreadId && editingTitle.trim()) {
      onRenameThread?.(editingThreadId, editingTitle.trim());
    }
    setEditingThreadId(null);
    setEditingTitle('');
  }

  function cancelEdit() {
    setEditingThreadId(null);
    setEditingTitle('');
  }

  return (
    <div className={`flex flex-col h-full w-[260px] flex-shrink-0 glass-sidebar ${className}`}>
      {/* ── Top section: Review queue + Add project ── */}
      <div className="flex flex-col border-b border-border-subtle">
        {/* Review Queue */}
        {reviewQueueCount > 0 && (
          <button
            type="button"
            onClick={onReviewQueueClick}
            className="flex items-center gap-2 mx-2 mt-2 px-2 py-1.5 rounded-md border border-status-warning-border bg-status-warning-bg text-xs text-status-warning-text hover:brightness-110 transition-all"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span className="font-medium">{reviewQueueCount} awaiting review</span>
          </button>
        )}

        {/* Add new project button — Codex style */}
        {onAddProject && (
          <button
            type="button"
            onClick={onAddProject}
            className="flex items-center justify-between mx-2 my-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[12px] text-text-secondary hover:border-accent-cyan/30 hover:text-text-primary hover:bg-accent-cyan/5 transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <FolderPlus className="h-3.5 w-3.5 text-text-muted" />
              <span className="font-medium">Add new project</span>
            </div>
            <kbd className="flex items-center gap-0.5 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
              <span>&#8984;</span><span>O</span>
            </kbd>
          </button>
        )}
      </div>

      {/* ── Threads section header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 mt-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
          Threads
        </span>
        {onSettings && (
          <button
            type="button"
            onClick={onSettings}
            className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Project & Thread List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-elegant">
        {projects.map((project) => {
          const isCollapsed = collapsedProjects.has(project.id);
          const showContextMenu = contextMenuProjectId === project.id;

          return (
            <div key={project.id} className="relative">
              {/* Project Header */}
              <div className="group/project flex w-full items-center gap-1 px-3 py-2 text-[12px] font-semibold text-text-secondary hover:bg-white/[0.03] transition-all duration-150 mt-1 first:mt-0">
                <button
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  className="flex flex-1 items-center gap-1.5 min-w-0"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-text-muted flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-text-muted flex-shrink-0" />
                  )}
                  <FolderGit className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                  <span className="truncate">{project.name}</span>
                </button>

                {/* Hover action icons — ... menu + new thread */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/project:opacity-100 transition-all flex-shrink-0">
                  {/* Context menu (remove) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (showContextMenu) {
                        closeContextMenu();
                      } else {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenuPosition({ top: rect.bottom + 4, left: rect.left });
                        setContextMenuProjectId(project.id);
                      }
                    }}
                    className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                    title="More actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>

                  {/* New thread in this project */}
                  {onNewThreadInProject && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewThreadInProject(project.id);
                      }}
                      className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                      title={`Start new thread in ${project.name}`}
                    >
                      <SquarePen className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Context menu dropdown — rendered via portal to avoid overflow clipping */}
              {showContextMenu && menuPosition && ReactDOM.createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={closeContextMenu} />
                  <div
                    className="fixed z-[9999] w-40 rounded-md border border-border-strong bg-bg-surface shadow-xl py-1"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                  >
                    {onRemoveProject && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveProject(project.id);
                          closeContextMenu();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-status-error-text hover:bg-state-hover transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove project
                      </button>
                    )}
                  </div>
                </>,
                document.body,
              )}

              {/* Thread List */}
              {!isCollapsed && (
                <div className="flex flex-col">
                  {project.threads.length === 0 && (
                    <div className="pl-9 pr-3 py-1.5 text-[11px] text-text-muted italic">
                      No threads
                    </div>
                  )}
                  {project.threads.map((thread) => {
                    const isActive = activeThreadId === thread.id;
                    const isEditing = editingThreadId === thread.id;

                    return (
                      <div
                        key={thread.id}
                        className={`group flex items-center gap-2 pl-9 pr-2 py-1.5 cursor-pointer transition-all duration-150 ${
                          isActive
                            ? 'bg-accent-cyan/8 text-text-primary border-l-2 border-l-accent-cyan pl-[34px]'
                            : 'text-text-secondary hover:bg-white/[0.03] hover:text-text-primary border-l-2 border-l-transparent'
                        }`}
                        onClick={() => !isEditing && onThreadSelect?.(thread.id)}
                      >
                        <StatusDot status={thread.liveStatus} />

                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="flex-1 min-w-0 rounded-md border border-border-subtle bg-bg-app px-1.5 py-0.5 text-xs text-text-primary"
                              autoFocus
                            />
                            <button type="button" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="p-0.5 text-status-success-text"><Check className="h-3 w-3" /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="p-0.5 text-text-muted"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 truncate text-[13px] font-medium">{thread.title || 'Untitled'}</span>
                            <span className="text-[11px] text-text-muted flex-shrink-0">{formatRelativeTime(thread.updatedAt)}</span>
                            {/* Hover actions */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                              {onRenameThread && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(thread); }} className="p-0.5 text-text-muted hover:text-text-primary" title="Rename">
                                  <Pencil className="h-2.5 w-2.5" />
                                </button>
                              )}
                              {onArchiveThread && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); onArchiveThread(thread.id); }} className="p-0.5 text-text-muted hover:text-text-primary" title="Archive">
                                  <Archive className="h-2.5 w-2.5" />
                                </button>
                              )}
                              {onDeleteThread && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }} className="p-0.5 text-text-muted hover:text-status-error-text" title="Delete">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <FolderGit className="h-6 w-6 mb-2 opacity-20" />
            <span className="text-xs">No projects yet</span>
            <span className="text-[10px] mt-1">Add a project folder to get started</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-3 py-2">
        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-text-muted hover:bg-white/[0.04] hover:text-text-primary transition-all duration-150"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
      </div>
    </div>
  );
}
