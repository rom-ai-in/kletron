'use client';

import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/utils';
import {
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
  Loader2,
  Plus,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import { WORK_MODES, type WorkModeId } from '@kletron/shared/workMode';
import {
  type ThreadRecencyBucket,
  THREAD_RECENCY_LABELS,
  THREAD_RECENCY_SECTION_ORDER,
  parseThreadRecencyMs,
  threadRecencyBucket,
} from '@kletron/shared/threadRecency';
import type { LucideIcon } from 'lucide-react';
import { WorkModeSegmented } from './WorkModeSegmented';
import { SidebarNavGroup, SidebarNavItem } from '../nav/SidebarNav';
import type { ThreadLiveStatus } from '@kletron/shared/chatTypes';

export type { ThreadLiveStatus };

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
  /** Return a rejected promise on failure so the inline editor stays open. */
  onRenameThread?: (threadId: string, newTitle: string) => void | Promise<void>;
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
  /** Label of the top nav row that starts a thread (default "New Agent"). */
  newSessionButtonLabel?: string;
  /** Renders the "Automation" row under "New Agent". */
  onOpenAutomations?: () => void;
  /** Highlights the Automation row when that surface is showing. */
  automationsActive?: boolean;
  /** Renders the "Settings" row. Falls back to `onSettings` when omitted. */
  onOpenCustomize?: () => void;
  /** Highlights the Settings row. */
  customizeActive?: boolean;
  /**
   * Secondary destinations behind the "More" disclosure. Pass these when this
   * rail is the app's only sidebar, so nothing becomes unreachable.
   */
  moreLinks?: SidebarMoreLink[];
  /**
   * Top slot — the account block sits above everything, like the desktop shell.
   * On macOS the caller must reserve the traffic-light zone here.
   */
  header?: React.ReactNode;
  /** Extra bottom slot, above the Settings row. */
  footer?: React.ReactNode;
}

export interface SidebarMoreLink {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
}

function StatusDot({ status }: { status: ThreadLiveStatus }) {
  if (status === 'idle') return null;

  const label: Record<ThreadLiveStatus, string> = {
    running: 'Run in progress',
    completed: 'Finished',
    completed_unread: 'Finished — open to review',
    waiting: 'Waiting',
    error: 'Failed',
    idle: '',
  };

  const title = label[status];
  const wrap =
    'relative inline-flex h-4 w-4 flex-shrink-0 items-center justify-center';

  switch (status) {
    case 'running':
      return (
        <span className={wrap} title={title} aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-status-success shadow-[0_0_0_2px_var(--status-success-bg)] animate-pulse" />
        </span>
      );
    case 'completed_unread':
      return (
        <span className={wrap} title={title} aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-status-info shadow-[0_0_0_2px_var(--status-info-bg)] ring-2 ring-status-info/55" />
        </span>
      );
    case 'completed':
      return (
        <span className={wrap} title={title} aria-hidden>
          <span className="h-2 w-2 rounded-full bg-status-success/85 ring-1 ring-status-success/35" />
        </span>
      );
    case 'waiting':
      return (
        <span className={wrap} title={title} aria-hidden>
          <span className="h-2 w-2 rounded-full bg-status-warning ring-1 ring-status-warning/50" />
        </span>
      );
    case 'error':
      return (
        <span className={wrap} title={title} aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-status-error shadow-[0_0_0_2px_var(--status-error-bg)] ring-2 ring-status-error/50" />
        </span>
      );
    default:
      return null;
  }
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
  newSessionButtonLabel = 'New Agent',
  onOpenAutomations,
  automationsActive = false,
  onOpenCustomize,
  customizeActive = false,
  moreLinks,
  header,
  footer,
}: ProjectSidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [renameCommitting, setRenameCommitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [contextMenuProjectId, setContextMenuProjectId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [threadFilter, setThreadFilter] = useState<SidebarFilter>('all');
  /** Per-project expanded state for the Archived block (default collapsed). */
  const [archivedExpandedProjects, setArchivedExpandedProjects] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);

  const recencyNow = new Date();

  /** One workspace / folder — hide redundant project name row (shown in shell search). */
  const singleWorkspaceProject = projects.length === 1;
  const threadRowPl = singleWorkspaceProject ? 'pl-3' : 'pl-9';
  const threadRowPlActive = singleWorkspaceProject ? 'pl-[10px]' : 'pl-[34px]';

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

  const startEdit = useCallback((thread: SidebarThread) => {
    setRenameError(null);
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title || '');
  }, []);

  const cancelEdit = useCallback(() => {
    if (renameCommitting) return;
    setEditingThreadId(null);
    setEditingTitle('');
    setRenameError(null);
  }, [renameCommitting]);

  const saveEdit = useCallback(async () => {
    if (!editingThreadId || !editingTitle.trim() || renameCommitting) return;
    const id = editingThreadId;
    const next = editingTitle.trim();
    if (!onRenameThread) {
      setEditingThreadId(null);
      setEditingTitle('');
      return;
    }
    setRenameCommitting(true);
    setRenameError(null);
    try {
      await onRenameThread(id, next);
      setEditingThreadId(null);
      setEditingTitle('');
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Could not rename thread');
    } finally {
      setRenameCommitting(false);
    }
  }, [editingThreadId, editingTitle, onRenameThread, renameCommitting]);

  const showTopSection = reviewQueueCount > 0 || Boolean(onAddProject && showAddProjectButton);

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 flex-col',
        surface === 'solid'
          ? 'bg-bg-rail border-r border-white/[0.06]'
          : 'glass-sidebar',
        className,
      )}
      style={{ width: 260, ...style }}
    >
      {header ? <div className="flex-none">{header}</div> : null}

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

      {/* ── Mode switch, then the primary nav rows (New Agent → Automation → Settings) ── */}
      <div className="mt-1 flex flex-col gap-2 px-3 py-2">
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

        <SidebarNavGroup>
          {onNewThreadInProject && projects.length > 0 ? (
            <SidebarNavItem
              icon={Plus}
              label={newSessionButtonLabel}
              title="Start a new agent thread"
              onClick={() => {
                const targetId =
                  activeProjectId && projects.some((p) => p.id === activeProjectId)
                    ? activeProjectId
                    : projects[0]?.id;
                if (targetId) {
                  onNewThreadInProject(targetId);
                }
              }}
            />
          ) : null}

          {onOpenAutomations ? (
            <SidebarNavItem
              icon={Zap}
              label="Automation"
              active={automationsActive}
              onClick={onOpenAutomations}
            />
          ) : null}

          {moreLinks && moreLinks.length > 0 ? (
            <>
              <SidebarNavItem
                icon={MoreHorizontal}
                label="More"
                active={moreOpen}
                expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              />
              {moreOpen
                ? moreLinks.map((link) => (
                    <SidebarNavItem
                      key={link.label}
                      icon={link.icon}
                      label={link.label}
                      active={link.active ?? false}
                      onClick={link.onClick}
                      className="pl-4"
                    />
                  ))
                : null}
            </>
          ) : null}
        </SidebarNavGroup>
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
          /* Skeleton — mirrors project header + thread rows (title + status dot + time), desktop + web */
          <div
            className="animate-in fade-in duration-200 px-3 py-2 space-y-1"
            role="status"
            aria-busy="true"
            aria-label="Loading threads"
          >
            {!singleWorkspaceProject ? (
              <div className="mt-1 flex items-center gap-1.5 py-2">
                <div className="h-3 w-3 shrink-0 rounded bg-bg-elevated animate-pulse" />
                <div className="h-3.5 w-3.5 shrink-0 rounded bg-bg-elevated animate-pulse" />
                <div className="h-3 w-[52%] max-w-[140px] rounded bg-bg-elevated animate-pulse" />
              </div>
            ) : (
              <div className="mt-1 py-1" aria-hidden />
            )}
            {[72, 58, 88, 48, 68, 55].map((width, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 border-l-2 border-l-transparent py-1.5 pr-2',
                  threadRowPl,
                )}
              >
                <div
                  className="h-3 flex-1 rounded bg-bg-elevated animate-pulse"
                  style={{ maxWidth: `${width}%` }}
                />
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-bg-elevated animate-pulse" />
                <div className="h-3 w-7 shrink-0 rounded bg-bg-elevated/80 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <>
        {projects.map((project) => {
          const hideFolderHeader = singleWorkspaceProject;
          const isCollapsed = hideFolderHeader ? false : collapsedProjects.has(project.id);
          const showContextMenu = contextMenuProjectId === project.id;
          const isHealthy = !project.health || project.health === 'healthy';

          return (
            <div key={project.id} className="relative">
              {/* Project header — skipped for single workspace (name lives in app chrome). */}
              {!hideFolderHeader ? (
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
              ) : null}

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
                        <div className={cn('pr-3 py-1.5 text-[11px] text-text-muted italic', threadRowPl)}>
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
                            'group flex cursor-pointer items-center gap-2 border-l-2 py-1.5 pr-2 transition-all duration-150',
                            isActive
                              ? cn(
                                  'border-l-white/25 bg-state-selected text-text-primary',
                                  threadRowPlActive,
                                )
                              : cn(
                                  'border-l-transparent text-text-secondary hover:bg-white/[0.03] hover:text-text-primary',
                                  threadRowPl,
                                ),
                          )}
                          onClick={() => !isEditing && onThreadSelect?.(thread.id)}
                        >
                          <StatusDot status={thread.liveStatus} />

                          {isEditing ? (
                            <div className="flex flex-1 flex-col gap-1 min-w-0">
                              <div className="flex min-w-0 items-center gap-1">
                                <input
                                  value={editingTitle}
                                  onChange={(e) => {
                                    setRenameError(null);
                                    setEditingTitle(e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void saveEdit();
                                    }
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  disabled={renameCommitting}
                                  className="min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-app px-1.5 py-0.5 text-xs text-text-primary disabled:opacity-60"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  title="Save"
                                  aria-label="Save thread name"
                                  disabled={renameCommitting || !editingTitle.trim()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void saveEdit();
                                  }}
                                  className="p-0.5 text-status-success-text disabled:opacity-40"
                                >
                                  {renameCommitting ? (
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                  ) : (
                                    <Check className="h-3 w-3" aria-hidden />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  title="Cancel"
                                  aria-label="Cancel rename"
                                  disabled={renameCommitting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEdit();
                                  }}
                                  className="p-0.5 text-text-muted disabled:opacity-40"
                                >
                                  <X className="h-3 w-3" aria-hidden />
                                </button>
                              </div>
                              {renameError ? (
                                <p className="text-[10px] leading-snug text-status-error-text">{renameError}</p>
                              ) : null}
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
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        window.confirm(
                                          'Delete this thread? This cannot be undone.',
                                        )
                                      ) {
                                        onDeleteThread(thread.id);
                                      }
                                    }}
                                    className="p-0.5 text-text-muted hover:text-status-error-text"
                                    title="Delete"
                                  >
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
                              <div
                                className={cn(
                                  'pr-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted',
                                  threadRowPl,
                                )}
                              >
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
                              className={cn(
                                'flex w-full items-center gap-1.5 pr-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-colors',
                                threadRowPl,
                              )}
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

      {footer ? <div className="flex-none border-t border-white/[0.06]">{footer}</div> : null}

      {/* ── Bottom: Settings, the last thing in the rail ── */}
      {showThreadsSettingsButton && (onOpenCustomize || onSettings) ? (
        <div className="flex-none border-t border-white/[0.06] p-3">
          <SidebarNavItem
            icon={SlidersHorizontal}
            label="Settings"
            active={customizeActive}
            onClick={onOpenCustomize ?? onSettings}
          />
        </div>
      ) : null}

    </div>
  );
}
