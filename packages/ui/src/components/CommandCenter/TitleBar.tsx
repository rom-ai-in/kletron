'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  FolderOpen,
  Code2,
  GitCommitHorizontal,
  TerminalSquare,
  ChevronDown,
  GitCompareArrows,
  PanelRight,
  Upload,
  GitPullRequest,
  Loader2,
  Check,
  FolderPlus,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { TrafficLights } from '../ui/TrafficLights';
import { ThreadSearchHeaderTrigger } from './ThreadSearchHeaderTrigger';

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
  /** Remove the active workspace from Kletron (e.g. desktop — sidebar no longer exposes this). */
  onRemoveWorkspace?: () => void;
  /** Active thread title shown in the center */
  threadTitle?: string;
  /** Optional extra content rendered in the center */
  center?: React.ReactNode;
  /** Git diff stats to show on the right */
  gitDiffStats?: GitDiffStats | null;
  /** Show custom traffic light dots (set false in Electron where native ones exist) */
  showTrafficLights?: boolean;
  /**
   * Reserve the macOS traffic-light inset on the leading edge. Defaults to true
   * whenever the OS draws the lights over this bar. Pass false when a
   * full-height sidebar sits to the left and already owns that zone.
   */
  reserveTrafficLightInset?: boolean;
  /** Hide the small workspace label on the leading edge (e.g. desktop when workspace appears in center search). */
  hideLeadingWorkspaceLabel?: boolean;
  /** Callbacks for top-bar actions — opens workspace in external editor (e.g. VS Code) */
  onOpen?: () => void;
  /** Label for the editor button (default: "Editor") */
  openEditorLabel?: string;
  /** Tooltip for the editor button */
  openEditorTitle?: string;
  /** Desktop: Code mode shows VS Code icon; Work mode shows folder icon for native reveal */
  openActionVariant?: 'vscode' | 'native-folder';
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
  /** Right source-control sidebar (e.g. Unstaged / Staged file list) */
  onToggleSourceControl?: () => void;
  sourceControlVisible?: boolean;
  onShare?: () => void;
  onRun?: () => void;
  /** Opens workspace thread quick search (desktop command center). */
  onOpenThreadSearch?: () => void;
  threadSearchPlaceholder?: string;
  threadSearchDisabled?: boolean;
  /** Trailing slot on the far right — desktop puts the account status chip here. */
  account?: React.ReactNode;
}

export function TitleBar({
  workspaceName = 'Kletron Desktop',
  workspaceSelectorLabel,
  onWorkspaceSelectorClick,
  workspaceItems,
  activeWorkspaceId,
  onWorkspaceSelect,
  onAddWorkspace,
  onRemoveWorkspace,
  threadTitle,
  center,
  gitDiffStats,
  showTrafficLights = true,
  reserveTrafficLightInset,
  hideLeadingWorkspaceLabel = false,
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
  onToggleSourceControl,
  sourceControlVisible,
  onShare,
  onRun,
  openEditorLabel = 'Folder',
  openEditorTitle = 'Open workspace folder in external editor',
  openActionVariant,
  onOpenThreadSearch,
  threadSearchPlaceholder = '',
  threadSearchDisabled = false,
  account,
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

  const showLeadingCluster =
    showTrafficLights || !hideLeadingWorkspaceLabel || Boolean(onOpenThreadSearch);

  return (
    <header
      className={`relative z-50 flex h-9 items-center justify-between glass-titlebar px-4 app-region-drag ${
        (reserveTrafficLightInset ?? !showTrafficLights) ? 'pl-[76px]' : ''
      }`}
    >
      {/* Left: traffic lights + workspace name + optional thread search */}
      {showLeadingCluster ? (
        <div className="flex min-w-0 max-w-[min(100%,50%)] shrink items-center gap-2 app-region-no-drag">
          {showTrafficLights && <TrafficLights className="app-region-no-drag" />}
          {!hideLeadingWorkspaceLabel ? (
            <div className="text-[11px] font-medium text-text-muted truncate max-w-[120px]">
              {workspaceName}
            </div>
          ) : null}
          {onOpenThreadSearch ? (
            <ThreadSearchHeaderTrigger
              onClick={onOpenThreadSearch}
              placeholder={threadSearchPlaceholder}
              disabled={threadSearchDisabled}
            />
          ) : null}
        </div>
      ) : null}

      {/* Center: interactive strip is no-drag; flex siblings stay draggable for window move */}
      <div className="flex flex-1 items-center min-w-0 self-stretch px-2">
        <div className="app-region-drag flex-1 min-h-[1px] min-w-[12px] self-stretch" aria-hidden />
        <div className="flex max-w-[min(100%,42rem)] w-full shrink-0 items-center justify-center px-2 app-region-no-drag">
          {center ??
            (threadTitle ? (
              <span className="max-w-[400px] truncate text-[13px] font-medium text-text-primary">
                {threadTitle}
              </span>
            ) : null)}
        </div>
        <div className="app-region-drag flex-1 min-h-[1px] min-w-[12px] self-stretch" aria-hidden />
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

                {onRemoveWorkspace && (
                  <>
                    <div className="my-1 mx-2 border-t border-white/[0.06]" />
                    <button
                      type="button"
                      onClick={() => {
                        setWsMenuOpen(false);
                        onRemoveWorkspace();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-status-error-text hover:bg-white/[0.06] transition-all duration-150"
                    >
                      <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Remove workspace from Kletron</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : onWorkspaceSelectorClick ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onWorkspaceSelectorClick}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
              title="Select workspace folder"
            >
              <span className="truncate max-w-[140px]">{workspaceSelectorLabel}</span>
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {onRemoveWorkspace ? (
              <button
                type="button"
                onClick={() => onRemoveWorkspace()}
                className="rounded-md p-1.5 text-text-muted hover:bg-white/[0.06] hover:text-status-error-text transition-all duration-150"
                title="Remove workspace from Kletron"
                aria-label="Remove workspace from Kletron"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null)}

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

        {/* Open workspace in external IDE */}
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
            title={openEditorTitle}
          >
            {openActionVariant === 'vscode' ? (
              <Code2 className="h-3 w-3" />
            ) : (
              <FolderOpen className="h-3 w-3" />
            )}
            {openEditorLabel}
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
        {(onOpen || hasGitActions) && (onToggleTerminal || onToggleChanges || onToggleSourceControl || onShare || gitDiffStats) && (
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

        {/* Source control sidebar (Unstaged / Staged) */}
        {onToggleSourceControl && (
          <button
            type="button"
            onClick={onToggleSourceControl}
            className={`rounded-md p-1.5 transition-all duration-150 ${sourceControlVisible ? 'text-accent-cyan bg-accent-cyan/10' : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'}`}
            title="Toggle source control sidebar (⌘⇧B)"
          >
            <PanelRight className="h-3.5 w-3.5" />
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

        {/* Account status chip (trailing edge) */}
        {account && (
          <>
            <div className="w-px h-3.5 bg-white/[0.08] mx-1" />
            {account}
          </>
        )}
      </div>
    </header>
  );
}
