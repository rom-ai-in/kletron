'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  FolderOpen,
  GitCommitHorizontal,
  TerminalSquare,
  Share2,
  ChevronDown,
  GitCompareArrows,
  Upload,
  GitPullRequest,
  Loader2,
  Check,
  FolderPlus,
  AlertTriangle,
} from 'lucide-react';
import { TrafficLights } from '../ui/TrafficLights';

export interface GitDiffStats {
  additions: number;
  deletions: number;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  rootPath: string;
  health?: 'healthy' | 'missing' | 'inaccessible';
  healthMessage?: string | null;
}

export interface TitleBarProps {
  workspaceName?: string;
  /** Optional label + handler for a workspace selector pill on the right */
  workspaceSelectorLabel?: string;
  onWorkspaceSelectorClick?: () => void;
  /** All available workspaces for dropdown */
  workspaceItems?: WorkspaceItem[];
  /** Currently active workspace ID */
  activeWorkspaceId?: string | null;
  /** Called when user selects a workspace from dropdown */
  onWorkspaceSelect?: (workspaceId: string) => void;
  /** Called when user clicks 'Add project' in dropdown */
  onAddWorkspace?: () => void;
  /** Active thread title shown in the center */
  threadTitle?: string;
  /** Optional extra content rendered in the center */
  center?: React.ReactNode;
  /** Git diff stats to show on the right */
  gitDiffStats?: GitDiffStats | null;
  /** Show custom traffic light dots (set false in Electron where native ones exist) */
  showTrafficLights?: boolean;
  /** Callbacks for top-bar actions */
  onOpen?: () => void;
  onCommit?: () => void;
  onPush?: () => void;
  onCreatePR?: () => void;
  /** Loading states for git actions */
  committing?: boolean;
  pushing?: boolean;
  creatingPR?: boolean;
  onToggleTerminal?: () => void;
  onToggleChanges?: () => void;
  changesVisible?: boolean;
  onShare?: () => void;
  onRun?: () => void;
}

export function TitleBar({
  workspaceName = 'Numezis Desktop',
  workspaceSelectorLabel,
  onWorkspaceSelectorClick,
  workspaceItems,
  activeWorkspaceId,
  onWorkspaceSelect,
  onAddWorkspace,
  threadTitle,
  center,
  gitDiffStats,
  showTrafficLights = true,
  onOpen,
  onCommit,
  onPush,
  onCreatePR,
  committing,
  pushing,
  creatingPR,
  onToggleTerminal,
  onToggleChanges,
  changesVisible,
  onShare,
  onRun,
}: TitleBarProps) {
  const [gitMenuOpen, setGitMenuOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const gitMenuRef = useRef<HTMLDivElement>(null);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!gitMenuOpen && !wsMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (gitMenuOpen && gitMenuRef.current && !gitMenuRef.current.contains(e.target as Node)) {
        setGitMenuOpen(false);
      }
      if (wsMenuOpen && wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [gitMenuOpen, wsMenuOpen]);

  const hasGitActions = onCommit || onPush || onCreatePR;

  return (
    <header className={`relative z-50 flex h-9 items-center justify-between glass-titlebar px-4 app-region-drag ${!showTrafficLights ? 'pl-[76px]' : ''}`}>
      {/* Left: traffic lights + workspace name */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
        {showTrafficLights && <TrafficLights className="app-region-no-drag" />}
        <div className="text-[11px] font-medium text-text-muted truncate max-w-[120px]">
          {workspaceName}
        </div>
      </div>

      {/* Center: thread title (replaces tab bar) */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-4">
        {center ?? (
          threadTitle && (
            <span className="text-[13px] font-medium text-text-primary truncate max-w-[400px]">
              {threadTitle}
            </span>
          )
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1 app-region-no-drag flex-shrink-0">
        {/* Workspace selector dropdown */}
        {workspaceSelectorLabel && (workspaceItems && workspaceItems.length > 0 ? (
          <div className="relative" ref={wsMenuRef}>
            <button
              type="button"
              onClick={() => setWsMenuOpen((p) => !p)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150 ${
                wsMenuOpen
                  ? 'bg-white/[0.08] text-text-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
              }`}
              title="Select workspace"
            >
              <span className="truncate max-w-[140px]">{workspaceSelectorLabel}</span>
              <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-150 ${wsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {wsMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[260px] max-w-[340px] rounded-lg border border-white/[0.08] py-1" style={{ backgroundColor: '#1c1c20', boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)' }}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Workspaces
                </div>

                {workspaceItems.map((ws) => {
                  const isActive = ws.id === activeWorkspaceId;
                  const isHealthy = (ws.health ?? 'healthy') === 'healthy';
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        setWsMenuOpen(false);
                        if (!isActive && onWorkspaceSelect) onWorkspaceSelect(ws.id);
                      }}
                      disabled={!isHealthy}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-all duration-150 disabled:opacity-50 ${
                        isActive
                          ? 'bg-white/[0.06] text-text-primary'
                          : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="w-4 flex-shrink-0 flex items-center justify-center">
                        {isActive && <Check className="h-3 w-3 text-accent-cyan" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium truncate">{ws.name}</div>
                        <div className="text-[10px] text-text-muted truncate">{ws.rootPath}</div>
                      </div>
                      {!isHealthy && (
                        <AlertTriangle className="h-3 w-3 text-status-warning flex-shrink-0" />
                      )}
                    </button>
                  );
                })}

                {onAddWorkspace && (
                  <>
                    <div className="my-1 mx-2 border-t border-white/[0.06]" />
                    <button
                      type="button"
                      onClick={() => { setWsMenuOpen(false); onAddWorkspace(); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      <span>Add new project</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : onWorkspaceSelectorClick && (
          <button
            type="button"
            onClick={onWorkspaceSelectorClick}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
            title="Select workspace folder"
          >
            <span className="truncate max-w-[140px]">{workspaceSelectorLabel}</span>
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        ))}

        {/* Run */}
        {onRun && (
          <button
            type="button"
            onClick={onRun}
            className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
            title="Run"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Open button */}
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
            title="Open in editor"
          >
            <FolderOpen className="h-3 w-3" />
            Open
          </button>
        )}

        {/* Commit dropdown */}
        {hasGitActions && (
          <div className="relative" ref={gitMenuRef}>
            <button
              type="button"
              onClick={() => setGitMenuOpen((p) => !p)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150 ${
                gitMenuOpen
                  ? 'bg-white/[0.08] text-text-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
              }`}
              title="Git actions"
            >
              <GitCommitHorizontal className="h-3 w-3" />
              Commit
              <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-150 ${gitMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {gitMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-lg border border-white/[0.08] py-1" style={{ backgroundColor: '#1c1c20', boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)' }}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Git actions
                </div>

                {onCommit && (
                  <button
                    type="button"
                    onClick={() => { setGitMenuOpen(false); onCommit(); }}
                    disabled={committing}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150 disabled:opacity-50"
                  >
                    {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommitHorizontal className="h-3.5 w-3.5" />}
                    <span>Commit</span>
                  </button>
                )}

                {onPush && (
                  <button
                    type="button"
                    onClick={() => { setGitMenuOpen(false); onPush(); }}
                    disabled={pushing}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150 disabled:opacity-50"
                  >
                    {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>Push</span>
                  </button>
                )}

                {onCreatePR && (
                  <>
                    <div className="my-1 mx-2 border-t border-white/[0.06]" />
                    <button
                      type="button"
                      onClick={() => { setGitMenuOpen(false); onCreatePR(); }}
                      disabled={creatingPR}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150 disabled:opacity-50"
                    >
                      {creatingPR ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitPullRequest className="h-3.5 w-3.5" />}
                      <span>Create PR</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        {(onOpen || hasGitActions) && (onToggleTerminal || onToggleChanges || onShare || gitDiffStats) && (
          <div className="w-px h-3.5 bg-white/[0.08] mx-1" />
        )}

        {/* Uncommitted Changes */}
        {onToggleChanges && (
          <button
            type="button"
            onClick={onToggleChanges}
            className={`rounded-md p-1.5 transition-all duration-150 ${changesVisible ? 'text-accent-cyan bg-accent-cyan/10' : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'}`}
            title="Toggle uncommitted changes (⌘⇧G)"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Terminal */}
        {onToggleTerminal && (
          <button
            type="button"
            onClick={onToggleTerminal}
            className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
            title="Toggle terminal (⌘J)"
          >
            <TerminalSquare className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Git diff stats pill */}
        {gitDiffStats && (gitDiffStats.additions > 0 || gitDiffStats.deletions > 0) && (
          <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-[11px] font-mono">
            {gitDiffStats.additions > 0 && (
              <span className="text-green-400">+{gitDiffStats.additions.toLocaleString()}</span>
            )}
            {gitDiffStats.deletions > 0 && (
              <span className="text-red-400">-{gitDiffStats.deletions.toLocaleString()}</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
