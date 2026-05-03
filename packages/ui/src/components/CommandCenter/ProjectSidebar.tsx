'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/utils';
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
  Bot,
} from 'lucide-react';
import { WORK_MODES, type WorkModeId } from '@kletron/shared/workMode';
import {
  type ThreadRecencyBucket,
  THREAD_RECENCY_LABELS,
  THREAD_RECENCY_SECTION_ORDER,
  parseThreadRecencyMs,
  threadRecencyBucket,
} from '@kletron/shared/threadRecency';
import { WorkModeSegmented } from './WorkModeSegmented';

export type ThreadLiveStatus = 'running' | 'completed' | 'idle' | 'waiting' | 'error';

export type SidebarThreadCategory = 'chat' | 'automation';

export interface SidebarThread {
  id: string;
  title: string;
  updatedAt?: string;
  liveStatus: ThreadLiveStatus;
  /**
   * Origin of the thread — used to badge automation-triggered runs and
   * power the in-sidebar filter row. Defaults to "chat" when missing.
   */
  category?: SidebarThreadCategory;
  /** When true, listed under the collapsible Archived section (still respects chat/auto filter). */
  archived?: boolean;
}

type SidebarFilter = 'all' | SidebarThreadCategory;

export interface SidebarProject {
  id: string;
  name: string;
  threads: SidebarThread[];
  /** When true, hide "New thread" and "Remove project" actions for this project */
  readonly?: boolean;
  health?: "healthy" | "missing" | "inaccessible";
  healthMessage?: string | null;
  selectable?: boolean;
}

export interface ProjectSidebarProps {
  projects: SidebarProject[];
  activeThreadId?: string | null;
  activeProjectId?: string | null;
  /** Show skeleton loading state (e.g. during workspace switch) */
  loading?: boolean;
  onThreadSelect?: (threadId: string) => void;
  /** Create a new thread inside a specific project */
  onNewThreadInProject?: (projectId: string) => void;
  /** Add a new project via folder picker */
  onAddProject?: () => void;
  /** When false, hide the top "Add new project" button (desktop: use TitleBar workspace menu + shortcuts). Default true. */
  showAddProjectButton?: boolean;
  onSettings?: () => void;
  /** When false, hide the settings control at the bottom of the sidebar. Default true. */
  showThreadsSettingsButton?: boolean;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  /** Remove a project from the sidebar */
  onRemoveProject?: (projectId: string) => void;
  /** Items awaiting review */
  reviewQueueCount?: number;
  onReviewQueueClick?: () => void;
  /**
   * `glass` — frosted panel (e.g. desktop). `solid` — flat surface + hairline edge (web agent).
   */
  surface?: 'glass' | 'solid';
  className?: string;
  style?: React.CSSProperties;
  /**
   * Code vs Work — drives which threads are listed. Pass with `onWorkModeChange` to show the switcher above the list.
   */
  workMode?: WorkModeId;
  onWorkModeChange?: (mode: WorkModeId) => void;
  /** Disable mode control (e.g. while workspace or threads are loading). */
  workModeSwitcherDisabled?: boolean;
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
  loading = false,
  onThreadSelect,
  onNewThreadInProject,
  onAddProject,
  showAddProjectButton = true,
  onSettings,
  showThreadsSettingsButton = true,
  onRenameThread,
  onArchiveThread,
  onDeleteThread,
  onRemoveProject,
  reviewQueueCount = 0,
  onReviewQueueClick,
  surface = 'glass',
  className = '',
  style,
  workMode,
  onWorkModeChange,
  workModeSwitcherDisabled = false,
}: ProjectSidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [contextMenuProjectId, setContextMenuProjectId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [threadFilter, setThreadFilter] = useState<SidebarFilter>('all');
  /** Per-project expanded state for the Archived block (default collapsed). */
  const [archivedExpandedProjects, setArchivedExpandedProjects] = useState<Set<string>>(() => new Set());

  const recencyNow = useMemo(() => new Date(), [projects, loading, threadFilter]);

  const filterChip = (id: SidebarFilter, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setThreadFilter(id)}
      className={cn(
        'px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider transition-colors',
        threadFilter === id
          ? 'bg-state-selected text-text-primary ring-1 ring-inset ring-white/[0.08]'
          : 'text-text-muted hover:text-text-secondary hover:bg-state-hover',
      )}
    >
      {label}
    </button>
  );

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

  const showTopSection = reviewQueueCount > 0 || Boolean(onAddProject && showAddProjectButton);

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 flex-col',
        surface === 'solid'
          ? 'bg-bg-surface border-r border-white/[0.06]'
          : 'glass-sidebar',
        className,
      )}
      style={{ width: 260, ...style }}
    >
      {/* ── Top section: Review queue + Add project (omit wrapper when empty to avoid orphan divider) ── */}
      {showTopSection && (
        <div className="flex flex-col border-b border-white/[0.06]">
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

          {onAddProject && showAddProjectButton && (
            <button
              type="button"
              onClick={onAddProject}
              className="flex items-center justify-between mx-2 my-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[12px] text-text-secondary hover:border-border-strong hover:bg-state-hover hover:text-text-primary transition-all duration-200"
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
      )}

      {/* ── Mode first (scopes list), then Threads header — icons stay muted, no accent stripe ── */}
      <div className="mt-1 flex flex-col gap-2 px-3 py-2.5">
        {workMode != null && onWorkModeChange ? (
          <div className="flex flex-col gap-1" role="region" aria-label="Code or work thread list">
            <WorkModeSegmented
              value={workMode}
              onChange={onWorkModeChange}
              disabled={workModeSwitcherDisabled}
              fullWidth
              showIcons
            />
            <p id="sidebar-work-mode-desc" className="text-[10px] leading-snug text-text-muted">
              <span className="font-medium text-text-secondary">{WORK_MODES[workMode].name}</span>{' '}
              threads — switch mode for a fresh composer.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <span
            id="project-sidebar-threads-heading"
            className="text-[11px] font-bold uppercase tracking-widest text-text-muted"
          >
            Threads
          </span>
          <div className="flex items-center gap-1">
            {onNewThreadInProject && projects.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const targetId =
                    activeProjectId && projects.some((p) => p.id === activeProjectId)
                      ? activeProjectId
                      : projects[0]?.id;
                  if (targetId) {
                    onNewThreadInProject(targetId);
                  }
                }}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                title="New thread"
              >
                New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Category filter chips (chat vs automation within this mode) ── */}
      <div className="flex items-center gap-1 px-3 pb-2">
        {filterChip('all', 'All')}
        {filterChip('chat', 'Chat')}
        {filterChip('automation', 'Auto')}
      </div>

      {/* ── Project & Thread List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-elegant">
        {loading ? (
          /* Skeleton loading state */
          <div className="px-3 py-2 space-y-1 animate-in fade-in duration-200">
            {/* Skeleton project header */}
            <div className="flex items-center gap-1.5 py-2 mt-1">
              <div className="h-3 w-3 rounded bg-bg-elevated animate-pulse flex-shrink-0" />
              <div className="h-3.5 w-3.5 rounded bg-bg-elevated animate-pulse flex-shrink-0" />
              <div className="h-3 w-24 rounded bg-bg-elevated animate-pulse" />
            </div>
            {/* Skeleton thread rows */}
            {[75, 60, 85, 50, 70].map((width, i) => (
              <div
                key={i}
                className="flex items-center gap-2 pl-9 pr-2 py-1.5 border-l-2 border-l-transparent"
              >
                <div className="h-3 rounded bg-bg-elevated animate-pulse flex-1" style={{ maxWidth: `${width}%` }} />
                <div className="h-3 w-6 rounded bg-bg-elevated animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <>
        {projects.map((project) => {
          const isCollapsed = collapsedProjects.has(project.id);
          const showContextMenu = contextMenuProjectId === project.id;
          const isHealthy = !project.health || project.health === 'healthy';

          return (
            <div key={project.id} className="relative">
              {/* Project Header */}
              <div
                className={`group/project flex w-full items-center gap-1 px-3 py-2 text-[12px] font-semibold transition-all duration-150 mt-1 first:mt-0 ${isHealthy ? 'text-text-secondary hover:bg-white/[0.03]' : 'text-text-muted opacity-50 cursor-not-allowed'}`}
                title={!isHealthy ? (project.healthMessage || 'Project inaccessible') : undefined}
              >
                <button
                  type="button"
                  onClick={() => isHealthy && toggleProject(project.id)}
                  disabled={!isHealthy}
                  className={`flex flex-1 items-center gap-1.5 min-w-0 ${!isHealthy && 'cursor-not-allowed'}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-text-muted flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-text-muted flex-shrink-0" />
                  )}
                  <FolderGit className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                  <span className="truncate">{project.name}</span>
                </button>

                {/* Hover action icons — … menu (only if handlers exist) + new thread */}
                {!project.readonly && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/project:opacity-100 transition-all flex-shrink-0">
                    {onRemoveProject && (
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
                    )}

                    {/* New thread in this project */}
                    {onNewThreadInProject && isHealthy && (
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
                )}
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

              {/* Thread List — grouped by recency; archived collapsed by default */}
              {!isCollapsed && (
                <div className="flex flex-col">
                  {(() => {
                    const filteredThreads = project.threads.filter((t) => {
                      if (threadFilter === 'all') return true;
                      const cat: SidebarThreadCategory = t.category ?? 'chat';
                      return cat === threadFilter;
                    });
                    if (filteredThreads.length === 0) {
                      return (
                        <div className="pl-9 pr-3 py-1.5 text-[11px] text-text-muted italic">
                          No threads
                        </div>
                      );
                    }

                    const activeThreads = filteredThreads.filter((t) => !t.archived);
                    const archivedThreads = filteredThreads.filter((t) => t.archived);

                    const buckets = new Map<ThreadRecencyBucket, SidebarThread[]>();
                    for (const b of THREAD_RECENCY_SECTION_ORDER) {
                      buckets.set(b, []);
                    }
                    for (const t of activeThreads) {
                      const b = threadRecencyBucket(t.updatedAt, recencyNow);
                      buckets.get(b)!.push(t);
                    }
                    for (const b of THREAD_RECENCY_SECTION_ORDER) {
                      buckets.get(b)!.sort((a, c) => {
                        const ma = parseThreadRecencyMs(a.updatedAt);
                        const mc = parseThreadRecencyMs(c.updatedAt);
                        if (ma == null && mc == null) return 0;
                        if (ma == null) return 1;
                        if (mc == null) return -1;
                        return mc - ma;
                      });
                    }

                    const archivedOpen = archivedExpandedProjects.has(project.id);

                    function renderThreadRow(thread: SidebarThread) {
                      const isActive = activeThreadId === thread.id;
                      const isEditing = editingThreadId === thread.id;
                      const isAutomation = (thread.category ?? 'chat') === 'automation';

                      return (
                        <div
                          key={thread.id}
                          className={cn(
                            'group flex cursor-pointer items-center gap-2 border-l-2 py-1.5 pl-9 pr-2 transition-all duration-150',
                            isActive
                              ? 'border-l-white/25 bg-state-selected pl-[34px] text-text-primary'
                              : 'border-l-transparent text-text-secondary hover:bg-white/[0.03] hover:text-text-primary',
                          )}
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
                              {isAutomation && (
                                <span
                                  title="Automation thread"
                                  className="inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded bg-bg-elevated text-text-muted ring-1 ring-inset ring-white/[0.08]"
                                >
                                  <Bot className="h-2.5 w-2.5" />
                                </span>
                              )}
                              <span className="flex-1 truncate text-[13px] font-medium">{thread.title || 'Untitled'}</span>
                              <span className="text-[11px] text-text-muted flex-shrink-0">{formatRelativeTime(thread.updatedAt)}</span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                                {onRenameThread && (
                                  <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(thread); }} className="p-0.5 text-text-muted hover:text-text-primary" title="Rename">
                                    <Pencil className="h-2.5 w-2.5" />
                                  </button>
                                )}
                                {onArchiveThread && !thread.archived && (
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
                    }

                    return (
                      <>
                        {THREAD_RECENCY_SECTION_ORDER.map((bucketId) => {
                          const list = buckets.get(bucketId)!;
                          if (list.length === 0) return null;
                          return (
                            <div key={bucketId} className="flex flex-col">
                              <div className="pl-9 pr-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                {THREAD_RECENCY_LABELS[bucketId]}
                              </div>
                              {list.map((thread) => renderThreadRow(thread))}
                            </div>
                          );
                        })}
                        {archivedThreads.length > 0 ? (
                          <div className="flex flex-col border-t border-white/[0.06] mt-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setArchivedExpandedProjects((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(project.id)) next.delete(project.id);
                                  else next.add(project.id);
                                  return next;
                                });
                              }}
                              className="flex w-full items-center gap-1.5 pl-9 pr-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-colors"
                            >
                              {archivedOpen ? (
                                <ChevronDown className="h-3 w-3 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                              )}
                              <Archive className="h-3 w-3 flex-shrink-0" />
                              <span>
                                Archived ({archivedThreads.length})
                              </span>
                            </button>
                            {archivedOpen ? archivedThreads.map((thread) => renderThreadRow(thread)) : null}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
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
          </>
        )}
      </div>

      {/* ── Bottom: settings (aligned with thread column width) ── */}
      {onSettings && showThreadsSettingsButton && (
        <div className="flex-none border-t border-white/[0.06] px-2 py-2">
          <button
            type="button"
            onClick={onSettings}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-[11px] font-medium text-text-muted transition-colors hover:bg-state-hover hover:text-text-primary"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      )}

    </div>
  );
}
